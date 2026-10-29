import json
import os
import boto3
from botocore.exceptions import ClientError
from engine.lineups import LINEUPS_VERSION, lineup_efficiency, lineup_weeks, lineups_inputs, season_lineups
from engine.recap import RECAP_VERSION, recap_inputs, weekly_recap
from engine.recap_summary import SUMMARY_VERSION, recap_facts, summary_inputs
from engine.report import REPORT_VERSION, report_inputs, season_report
from engine.rosters import merge_lineups, parse_adds, parse_lineups
from engine.season import last_played_week
from utils import (
    CACHE_BUCKET,
    check_end_year,
    check_start_year,
    espn_handler,
    load_history,
    load_rosters,
    load_season,
    load_week_views,
    season_is_final,
    week_is_final,
)
from utils.writeups import ai_league, invoke_async, writeup

s3 = boto3.client('s3')

WRITER_FUNCTION = os.environ.get('WRITE_RECAP_SUMMARY_FUNCTION', 'writeRecapSummary')

# Most summaries one week gets. A week's facts change with stat corrections,
# and each change is a new summary; past this, the recap shows none.
SUMMARY_LIMIT = 3


def check_year(league_id, year):
    """(start year, year), with year defaulting to the latest season, or an
    error body if the league has no such season. These make the live ESPN call
    first, so nothing is read from S3 without access."""
    end_year = check_end_year(None, league_id)
    start_year = check_start_year(None, league_id)
    year = end_year if year is None else int(year)
    if not start_year <= year <= end_year:
        return None, None, {"error": {"type": "GENERAL_NOT_FOUND", "message": f"This league has no {year} season."}}
    return start_year, year, None


def stored(key, compute):
    """The JSON stored at key, or compute() stored there."""
    try:
        return json.loads(s3.get_object(Bucket=CACHE_BUCKET, Key=key)['Body'].read())
    except ClientError as e:
        if e.response['Error']['Code'] != 'NoSuchKey':
            raise

    result = compute()
    try:
        s3.put_object(Bucket=CACHE_BUCKET, Key=key, Body=json.dumps(result),
                      ContentType='application/json')
        print(f"Stored {key}")
    except Exception as e:
        print(f"Failed to store {key}: {e}")
    return result


def report(league_id, year, season=None):
    """The season page's data (engine/report.py) for one season, computed on
    first request and stored. See "Core rules" in the README.

    A final season is stored by REPORT_VERSION alone, so it's served without
    loading the season. Any other season is stored under a hash of its inputs
    too, so it's recomputed only after a game finishes.
    """
    final = season_is_final(league_id, year)
    key = f'derived/{league_id}/{year}/season-report-v{REPORT_VERSION}.json'
    if not final:
        season = season or load_season(year, league_id)
        key = f'derived/{league_id}/{year}/season-report-v{REPORT_VERSION}-{report_inputs(season)}.json'

    result = stored(key, lambda: season_report(season or load_season(year, league_id)))
    return {**result, "final": final}


def recap(league_id, start_year, year, week):
    """One week's recap (engine/recap.py), by default the latest week whose
    games are all decided. Stored like the report: a final week by
    RECAP_VERSION alone, any other under a hash of the week's scores, so a stat
    correction recomputes it."""
    season = load_season(year, league_id)
    latest = last_played_week(season)
    week = latest if week is None else int(week)
    if not 1 <= week <= latest:
        return {"error": {"type": "GENERAL_NOT_FOUND", "message": f"Week {week} of {year} hasn't been played."}}

    periods = season.scoring_periods(week)
    final = week_is_final(league_id, year, max(periods))
    key = f'derived/{league_id}/{year}/weeks/{week}/recap-v{RECAP_VERSION}.json'
    if not final:
        key = f'derived/{league_id}/{year}/weeks/{week}/recap-v{RECAP_VERSION}-{recap_inputs(season, week)}.json'

    def compute():
        loaded = load_week_views(year, league_id, periods)
        by_period = [parse_lineups(roster, period) for period, roster, _ in loaded]
        adds = [add for _, _, transactions in loaded for add in parse_adds(transactions)]
        history = load_history(league_id, start_year, year)
        efficiency = lineup_efficiency(by_period, season.settings.lineup_slots)
        return weekly_recap(season, week, merge_lineups(by_period), adds,
                            report(league_id, year, season), history, efficiency)

    result = stored(key, compute)
    championship = result["playoffs"] and week == max(season.settings.matchup_periods, default=None)
    try:
        text, status = summary(league_id, year, week, result, championship)
    except Exception as e:
        # The recap doesn't depend on the summary; never fail the page over it
        print(f"Summary failed for {year} week {week}: {e}")
        text, status = None, 'failed'

    # The latest week isn't stored with the recap: it moves on every week
    return {**result, "final": final, "latest_week": latest, "summary": text, "summary_status": status}


def summary(league_id, year, week, recap, championship):
    """(text, status) for a few sentences of Claude's at the top of a recap,
    written from recap_facts (engine/recap_summary.py) and stored under a hash
    of them, so it's rewritten only if the facts change (utils/writeups.py).
    Only leagues in AI_LEAGUES get one, and only for a season that isn't final,
    so opening an old recap never calls Claude."""
    facts = recap_facts(recap, championship)
    prefix = f'derived/{league_id}/{year}/weeks/{week}/summary-v{SUMMARY_VERSION}-'
    key = f'{prefix}{summary_inputs(facts)}'
    text_key = f'{key}.txt'
    status_key = f'{key}.status.json'

    def allowed():
        if not ai_league(league_id) or season_is_final(league_id, year):
            return False
        listed = s3.list_objects_v2(Bucket=CACHE_BUCKET, Prefix=prefix).get('Contents', [])
        return sum(1 for o in listed if o['Key'].endswith('.status.json')) < SUMMARY_LIMIT

    def start():
        invoke_async(WRITER_FUNCTION, {"facts": facts, "text_key": text_key, "status_key": status_key})

    return writeup(text_key, status_key, allowed, start)


def lineups(league_id, year):
    """Each team's points left on the bench and games lost to lineup choices
    over the regular season (engine/lineups.py). Stored like the report: a
    final season by LINEUPS_VERSION alone, any other under a hash of its
    decided games. Not yet stored, it loads every week's rosters."""
    season = load_season(year, league_id)
    final = season_is_final(league_id, year)
    key = f'derived/{league_id}/{year}/lineups-v{LINEUPS_VERSION}.json'
    if not final:
        key = f'derived/{league_id}/{year}/lineups-v{LINEUPS_VERSION}-{lineups_inputs(season)}.json'

    def compute():
        weeks = lineup_weeks(season)
        rosters = load_rosters(year, league_id, [p for w in weeks for p in season.scoring_periods(w)])
        slots = season.settings.lineup_slots
        return season_lineups(season, {
            w: lineup_efficiency([parse_lineups(rosters[p], p) for p in season.scoring_periods(w)], slots)
            for w in weeks})

    return {**stored(key, compute), "final": final}


@espn_handler
def lambda_handler(event, context):
    params = event["queryStringParameters"]
    league_id = params["leagueId"]
    start_year, year, error = check_year(league_id, params.get("year"))
    if error:
        return error
    if event.get("routeKey") == "GET /recap":
        return recap(league_id, start_year, year, params.get("week"))
    if event.get("routeKey") == "GET /lineups":
        return lineups(league_id, year)
    return report(league_id, year)
