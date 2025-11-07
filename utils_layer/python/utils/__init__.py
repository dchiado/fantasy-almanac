import json
import requests
import boto3
from datetime import datetime, date
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
CACHE_BUCKET = 'ffalmanac-data'

def load_data(year, uri, league_id, week=None, headers=None):
    """
    Load ESPN fantasy data — caching all years to S3 except the current one.

    Args:
        year (int): Season year
        uri (str): ESPN mView endpoint
        league_id (int): ESPN league ID
        week (int or None): Optional scoring week
        headers (dict or None): Headers (e.g., for espn_s2 cookie)

    Returns:
        dict: ESPN data
    """
    current_year = datetime.now().year
    should_cache = year != current_year
    s3_key = f'espn-cache/{league_id}/{year}/{uri}.json'

    # Try to load from S3 first
    try:
        print(f"Checking S3 for {s3_key}")
        cached = s3.get_object(Bucket=CACHE_BUCKET, Key=s3_key)
        body = cached['Body'].read().decode('utf-8')
        json_body = json.loads(body)
        print(f"JSON body: {json_body}")
        if isinstance(json_body, (list, tuple)):
            return json_body[0] if json_body else None  # optional: handle empty list/tuple
        return json_body
    except ClientError as e:
        if e.response['Error']['Code'] != 'NoSuchKey':
            raise  # Unexpected error
        print(f"Not found in cache, calling ESPN API for {year}/{uri}")

    # Build the correct ESPN API URL
    if year > 2019:
        url = (
            f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}"
            f"/segments/0/leagues/{league_id}?view={uri}"
        )
        if week is not None:
            url += f"&scoringPeriodId={week}"
    else:
        url = (
            f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}"
            f"?seasonId={year}&view={uri}"
        )
        if week is not None:
            url += f"&scoringPeriodId={week}"

    print('Calling ESPN endpoint:', url)
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    data = resp.json()

    if should_cache:
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
    else:
        print(f"Skipping cache for current season ({year})")

    return data[0] if year <= 2018 else data


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
    if status["status"] == "preseason":
        return status["season"] - 1
    else:
        return status["season"]


def season_status(league_id):
    """Find the status of the current fantasy season"""
    this_year = date.today().year
    resp = load_data(this_year, 'mStatus', league_id)
    if "details" in resp:
        # try the year before because the season leaks into January
        if resp["details"][0]["type"] == 'GENERAL_NOT_FOUND':
            this_year = int(this_year) - 1
            resp = load_data(this_year, 'mStatus', league_id)
            if "details" in resp:
                return {
                    "error": resp["details"][0]
                }

    status = resp["status"]
    current_season = resp["seasonId"]
    drafted = resp["draftDetail"]["drafted"]
    finished = status["currentMatchupPeriod"] == status["finalScoringPeriod"]

    if not drafted:
        status = "preseason"
    elif status["currentMatchupPeriod"] == 1:
        status = "drafted"
    elif finished:
        status = "postseason"
    else:
        status = "active"

    return {
        "season": current_season,
        "status": status
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
    this_year = date.today().year
    details = load_data(this_year, 'mNav', league_id)
    if "details" in details:
        # try the year before because the season leaks into January
        if details["details"][0]["type"] == 'GENERAL_NOT_FOUND':
            this_year = int(this_year) - 1
            details = load_data(this_year, 'mNav', league_id)

    actual_start_year = details["status"]["previousSeasons"][0]

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
