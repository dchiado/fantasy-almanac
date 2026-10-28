import json
import boto3
from botocore.exceptions import ClientError
from engine.recap import RECAP_VERSION, recap_inputs, weekly_recap
from engine.report import REPORT_VERSION, report_inputs, season_report
from engine.rosters import merge_lineups, parse_adds, parse_lineups
from engine.season import last_played_week
from utils import (
    CACHE_BUCKET,
    check_end_year,
    check_start_year,
    espn_handler,
    load_history,
    load_season,
    load_week_views,
    season_is_final,
    week_is_final,
)

s3 = boto3.client('s3')


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
        lineups = merge_lineups([parse_lineups(roster, period) for period, roster, _ in loaded])
        adds = [add for _, _, transactions in loaded for add in parse_adds(transactions)]
        history = load_history(league_id, start_year, year)
        return weekly_recap(season, week, lineups, adds, report(league_id, year, season), history)

    # The latest week isn't stored with the recap: it moves on every week
    return {**stored(key, compute), "final": final, "latest_week": latest}


@espn_handler
def lambda_handler(event, context):
    params = event["queryStringParameters"]
    league_id = params["leagueId"]
    start_year, year, error = check_year(league_id, params.get("year"))
    if error:
        return error
    if event.get("routeKey") == "GET /recap":
        return recap(league_id, start_year, year, params.get("week"))
    return report(league_id, year)
