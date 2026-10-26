import json
import collections
import functools
import requests
import boto3
from concurrent.futures import ThreadPoolExecutor
from contextvars import ContextVar, copy_context
from itertools import groupby
from datetime import datetime, date, timedelta, timezone
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
CACHE_BUCKET = 'ffalmanac-data'

# ESPN applies stat corrections for a few days after a week ends, so a season
# whose last week is done is only final once this much time has passed
FINAL_GRACE_PERIOD = timedelta(days=7)
# Regular-season weeks left (including the current one) when the stretch run starts
STRETCH_RUN_WEEKS = 3

_espn_s2 = ContextVar('espn_s2', default=None)

# Final seasons never change, so they're kept in memory for as long as the Lambda
# container stays warm. Callers must treat load_data results as read-only.
_final_seasons = {}
# When each league's current season was first seen with every week played,
# keyed by (league_id, year). Read from the season's _finality.json marker.
_decided_at = {}
# Live ESPN responses (errors included), shared within a single request only
_request_cache = ContextVar('request_cache', default=None)


class EspnError(Exception):
    """ESPN refused the request; detail is the first entry of its "details" body."""
    def __init__(self, detail):
        super().__init__(detail.get("message"))
        self.detail = detail


def espn_handler(handler):
    """Decorate a lambda_handler so every ESPN call in the request sends the
    espnS2 query param as a cookie, and ESPN errors return as {"error": detail}."""
    @functools.wraps(handler)
    def wrapper(event, context):
        params = event.get("queryStringParameters") or {}
        token = _espn_s2.set(params.get("espnS2"))
        cache_token = _request_cache.set({})
        try:
            return handler(event, context)
        except EspnError as e:
            return {"error": e.detail}
        finally:
            _espn_s2.reset(token)
            _request_cache.reset(cache_token)
    return wrapper


def load_data(year, uri, league_id, week=None, headers=None):
    """
    Load ESPN fantasy data. Final seasons come from memory, then S3, then ESPN
    (and are written back to S3); a season that isn't final always comes from
    ESPN. See "Core rules" in the README.

    Args:
        year (int): Season year
        uri (str): ESPN mView endpoint
        league_id (int): ESPN league ID
        week (int or None): Optional scoring week
        headers (dict or None): Headers (e.g., for espn_s2 cookie)

    Returns:
        dict: ESPN data, or ESPN's error body (with "details") if it refused
    """
    year = int(year)
    if not season_is_final(league_id, year):
        return _load_live(year, uri, league_id, week, headers)

    key = (str(league_id), year, uri, week)
    if key in _final_seasons:
        return _final_seasons[key]

    data = _load_archived(year, uri, league_id, week, headers)
    if not _is_error(data):
        _final_seasons[key] = data  # errors aren't remembered; a later request may have a valid token
    return data


def _load_live(year, uri, league_id, week=None, headers=None):
    """Fetch from ESPN, sharing the response with the rest of this request."""
    key = (str(league_id), year, uri, week)
    request_cache = _request_cache.get()
    if request_cache is not None and key in request_cache:
        return request_cache[key]

    data = _unwrap(_fetch(year, uri, league_id, week, headers))
    if request_cache is not None:
        request_cache[key] = data
    return data


def _load_archived(year, uri, league_id, week, headers):
    """Read a final season from S3, or fetch it from ESPN and write it to S3."""
    s3_key = _archive_key(league_id, year, uri, week)
    try:
        cached = s3.get_object(Bucket=CACHE_BUCKET, Key=s3_key)
        return _unwrap(json.loads(cached['Body'].read().decode('utf-8')))
    except ClientError as e:
        if e.response['Error']['Code'] != 'NoSuchKey':
            raise  # Unexpected error
        print(f"Not found in cache, calling ESPN API for {year}/{uri}")

    data = _fetch(year, uri, league_id, week, headers)
    if _is_error(data):
        return data

    try:
        s3.put_object(
            Bucket=CACHE_BUCKET,
            Key=s3_key,
            Body=json.dumps(data),
            ContentType='application/json'
        )
        print(f"Cached {s3_key}")
    except Exception as e:
        print(f"Failed to cache {s3_key}: {e}")

    return _unwrap(data)


def _archive_key(league_id, year, uri, week=None):
    if week is not None:
        return f'espn-cache/{league_id}/{year}/weeks/{week}/{uri}.json'
    return f'espn-cache/{league_id}/{year}/{uri}.json'


def _is_error(data):
    return isinstance(data, dict) and "details" in data


def _fetch(year, uri, league_id, week, headers):
    """Call ESPN. Returns the raw response body, or ESPN's error body (with "details")."""
    # Build the correct ESPN API URL
    if year > 2019:
        url = (
            f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}"
            f"/segments/0/leagues/{league_id}?view={uri}"
        )
    else:
        url = (
            f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}"
            f"?seasonId={year}&view={uri}"
        )
    if week is not None:
        url += f"&scoringPeriodId={week}"

    espn_s2 = _espn_s2.get()
    if espn_s2:
        headers = {**(headers or {}), 'Cookie': f'espn_s2={espn_s2}'}

    print('Calling ESPN endpoint:', url)
    resp = requests.get(url, headers=headers)
    if not resp.ok:
        # ESPN explains auth/not-found failures in a "details" body; surface it instead of crashing
        try:
            body = resp.json()
        except ValueError:
            body = None
        if isinstance(body, dict) and "details" in body:
            return body
        resp.raise_for_status()
    return resp.json()


def _unwrap(data):
    """leagueHistory responses are a one-element list holding the season object."""
    if isinstance(data, (list, tuple)):
        return data[0] if data else None
    return data


def prefetch(league_id, years, views):
    """Load every (year, view) pair in parallel so the sequential loops that
    follow are served from memory. Failures are left for those loops to raise."""
    def load(year, view):
        try:
            load_data(year, view, league_id)
        except Exception as e:
            print(f"Prefetch failed for {year}/{view}: {e}")

    with ThreadPoolExecutor(max_workers=16) as pool:
        # Each task runs in a copy of this request's context so it sees the
        # espn_s2 token and shares the request cache
        futures = [
            pool.submit(copy_context().run, load, year, view)
            for year in years for view in views
        ]
        for future in futures:
            future.result()


def player_info(year, league_id):
    """Add necessary headers and call kona_player_info endpoint"""
    filters = {
        "players": {
            "limit": 1500,
            "sortDraftRanks": {
                "sortPriority": 100,
                "sortAsc": True,
                "value": "STANDARD"
            }
        }
    }
    headers = {'x-fantasy-filter': json.dumps(filters)}
    resp = load_data(year, 'kona_player_info', league_id, headers=headers)
    return resp["players"]


def load_matchups(year, league_id):
    """Call mMatchupScore endpoint and return schedule sub-object"""
    resp = load_data(year, 'mMatchupScore', league_id)
    return resp["schedule"]


def load_transactions(year, league_id, week=None):
    """Call mTransactions2 endpoint and return transactions sub-object"""
    resp = load_data(year, 'mTransactions2', league_id, week=week)
    return resp["transactions"]


def number_of_weeks(year, playoffs, league_id):
    """Determine weeks in season depending on whether playoffs are included"""
    season = load_data(year, 'mSettings', league_id)

    current_week = season["status"]["latestScoringPeriod"]
    total_weeks = season["status"]["finalScoringPeriod"]
    regular_season_weeks = (
        season["settings"]["scheduleSettings"]["matchupPeriodCount"]
    )

    if playoffs and (current_week <= total_weeks):
        return current_week - 1
    elif playoffs and (current_week > total_weeks):
        return total_weeks
    elif current_week <= regular_season_weeks:
        return current_week - 1
    else:
        return regular_season_weeks


def is_bye_week(matchup):
    """Determine if matchup object is a bye"""
    if ("away" in matchup) and ("home" in matchup):
        return False
    else:
        return True


def team_name(team_id, season_obj):
    """Get team name from season object given team id"""
    for team in season_obj["teams"]:
        if team["id"] == team_id:
            return team["name"]


def team_mapping(year, league_id):
    """Create team id - team name mapping for given year"""
    mteam = load_data(year, 'mTeam', league_id)
    m = {}
    for team in mteam["teams"]:
        m[team["id"]] = team["name"]
    return m


def fantasy_team_logo(team_id, season_obj):
    """Find team logo URL from seasons object based on team id"""
    for team in season_obj["teams"]:
        if team["id"] == team_id:
            return team["logo"]


def print_to_file(content, file):
    """Write data to a file"""
    f = open(file, 'w')
    f.write(repr(content))
    f.close()


def latest_season(league_id):
    """Find the latest completed or currently active fantasy season"""
    status = season_status(league_id)
    if "error" in status:
        raise EspnError(status["error"])
    if status["status"] == "preseason":
        return status["season"] - 1
    else:
        return status["season"]


def current_status(league_id):
    """Live mStatus for the league's current season, or ESPN's error body.

    This call is also the access check: archived seasons are only served
    after it succeeds in the same request."""
    this_year = date.today().year
    resp = _load_live(this_year, 'mStatus', league_id)
    # ESPN returns GENERAL_NOT_FOUND for the new calendar year until the league
    # rolls over, so the season leaks into the next year
    if _is_error(resp) and resp["details"][0]["type"] == 'GENERAL_NOT_FOUND':
        resp = _load_live(this_year - 1, 'mStatus', league_id)
    return resp


def _all_weeks_played(status_resp):
    """True once ESPN has moved past the season's last scoring period."""
    status = status_resp["status"]
    return status["latestScoringPeriod"] > status["finalScoringPeriod"]


def season_is_final(league_id, year):
    """Whether a season's ESPN data can no longer change.

    Seasons before the league's current one are final. The current season is
    final FINAL_GRACE_PERIOD after it was first seen with every week played,
    which is recorded in espn-cache/{league}/{year}/_finality.json. If ESPN
    refuses the live status call, nothing is final, so the request goes to
    ESPN and returns its error."""
    year = int(year)
    resp = current_status(league_id)
    if _is_error(resp) or year > resp["seasonId"]:
        return False
    if year < resp["seasonId"]:
        return True
    if not _all_weeks_played(resp):
        return False
    decided_at = _season_decided_at(league_id, year)
    return datetime.now(timezone.utc) - decided_at >= FINAL_GRACE_PERIOD


def _season_decided_at(league_id, year):
    """When the season was first seen with every week played, recording now if never."""
    key = (str(league_id), year)
    if key in _decided_at:
        return _decided_at[key]

    s3_key = f'espn-cache/{league_id}/{year}/_finality.json'
    try:
        marker = json.loads(s3.get_object(Bucket=CACHE_BUCKET, Key=s3_key)['Body'].read())
        decided_at = datetime.fromisoformat(marker["decided_at"])
    except ClientError as e:
        if e.response['Error']['Code'] != 'NoSuchKey':
            raise  # Unexpected error
        decided_at = datetime.now(timezone.utc)
        s3.put_object(
            Bucket=CACHE_BUCKET,
            Key=s3_key,
            Body=json.dumps({"decided_at": decided_at.isoformat()}),
            ContentType='application/json'
        )
        print(f"Recorded {s3_key}")

    _decided_at[key] = decided_at
    return decided_at


def season_status(league_id):
    """Find the status of the current fantasy season"""
    resp = current_status(league_id)
    if _is_error(resp):
        return {"error": resp["details"][0]}

    status = resp["status"]
    current_season = resp["seasonId"]
    drafted = resp["draftDetail"]["drafted"]

    if not drafted:
        status = "preseason"
    elif status["currentMatchupPeriod"] == 1:
        status = "drafted"
    elif _all_weeks_played(resp):
        status = "postseason"
    else:
        status = "active"

    return {
        "season": current_season,
        "status": status
    }


def season_phase(league_id):
    """Find which phase the league's current season is in. See "Season phases"
    in the README.

    Returns:
        {
            "season": 2026,
            "phase": "preseason" | "regular_season" | "stretch_run" | "playoffs" | "offseason",
            "regular_season_weeks": 14,
            "regular_season_weeks_left": 3  # including the current week
        }
    """
    resp = current_status(league_id)
    if _is_error(resp):
        return {"error": resp["details"][0]}

    year = resp["seasonId"]
    week = resp["status"]["currentMatchupPeriod"]
    settings = load_data(year, 'mSettings', league_id)
    regular_season_weeks = settings["settings"]["scheduleSettings"]["matchupPeriodCount"]
    weeks_left = max(0, regular_season_weeks - week + 1)

    if not resp["draftDetail"]["drafted"]:
        phase = "preseason"
    # The champion is known once every week is played, even before the data is final
    elif _all_weeks_played(resp):
        phase = "offseason"
    elif week > regular_season_weeks:
        phase = "playoffs"
    elif weeks_left <= STRETCH_RUN_WEEKS:
        phase = "stretch_run"
    else:
        phase = "regular_season"

    return {
        "season": year,
        "phase": phase,
        "regular_season_weeks": regular_season_weeks,
        "regular_season_weeks_left": weeks_left
    }


def headshot(player_id):
    """Create player headshot URL based on player id"""
    return ("https://a.espncdn.com/i/headshots/nfl/players/full/" +
            str(player_id) + ".png")


def team_logo(team):
    """Create NFL team logo URL based on team id"""
    if "D/ST" in team:
        team = team.split()[0]
    abrev = team_abbreviation(team)
    return "https://a.espncdn.com/i/teamlogos/nfl/500/" + abrev + ".png"


def team_abbreviation(team):
    """Map team names from D/ST positions to abbreviations"""
    abbreviations = {
        "49ers": "sf",
        "Bears": "chi",
        "Bengals": "cin",
        "Bills": "buf",
        "Broncos": "den",
        "Browns": "cle",
        "Buccaneers": "tb",
        "Cardinals": "ari",
        "Chargers": "lac",
        "Chiefs": "kc",
        "Colts": "ind",
        "Cowboys": "dal",
        "Dolphins": "mia",
        "Eagles": "phi",
        "Falcons": "atl",
        "Football Team": "was",
        "Giants": "nyg",
        "Jaguars": "jax",
        "Jets": "nyj",
        "Lions": "det",
        "Packers": "gb",
        "Panthers": "car",
        "Patriots": "ne",
        "Raiders": "lv",
        "Rams": "lar",
        "Ravens": "bal",
        "Redskins": "was",
        "Saints": "no",
        "Seahawks": "sea",
        "Steelers": "pit",
        "Texans": "hou",
        "Titans": "ten",
        "Vikings": "min",
        "Commanders": "was"
    }
    return abbreviations[team]


def active_teams(mteam):
    """Create list of active team id in the league"""
    teams = []
    for team in mteam["teams"]:
        teams.append(team["id"])
    return teams


def win_pct(win, loss):
    """Calculate win percentage"""
    pct = round((win / (win + loss))*100, 2)
    return str(pct) + '%'


def check_start_year(year, league_id):
    """Check year passed in is not earlier than first season"""
    details = current_status(league_id)
    if _is_error(details):
        raise EspnError(details["details"][0])

    previous = details["status"]["previousSeasons"]
    actual_start_year = previous[0] if previous else details["seasonId"]

    if year is None or int(year) < actual_start_year:
        return actual_start_year
    else:
        return int(year)


def check_end_year(year, league_id):
    """Check year is not later than current season"""
    latest = latest_season(league_id)
    if year is None or int(year) > latest:
        return latest
    else:
        return int(year)


def compare_lists(l1, l2):
    """Compare two lists, order independent"""
    return collections.Counter(l1) == collections.Counter(l2)


def current_streak(list):
    """First current streak given list of winners"""
    grouped = [[k, sum(1 for i in g)] for k, g in groupby(list)]
    return grouped[-1]


def longest_streak(list):
    """First longest anytime streak given list of winners"""
    grouped = [[k, sum(1 for i in g)] for k, g in groupby(list)]
    return sorted(grouped, key=lambda x: x[1], reverse=True)[0]
