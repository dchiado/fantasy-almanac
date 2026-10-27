import json
import boto3
from botocore.exceptions import ClientError
from engine.report import REPORT_VERSION, season_report
from utils import (
    CACHE_BUCKET,
    check_end_year,
    check_start_year,
    espn_handler,
    load_season,
    season_is_final,
)

s3 = boto3.client('s3')


def report(league_id, year):
    """The season page's data (engine/report.py) for one season.

    Final seasons are computed on first request and stored under a key that
    includes REPORT_VERSION; other seasons are computed on every request.
    See "Core rules" in the README.
    """
    # These make the live ESPN call first, so nothing is read from S3 without access
    end_year = check_end_year(None, league_id)
    start_year = check_start_year(None, league_id)
    year = end_year if year is None else int(year)
    if not start_year <= year <= end_year:
        return {"error": {"type": "GENERAL_NOT_FOUND", "message": f"This league has no {year} season."}}

    final = season_is_final(league_id, year)
    if not final:
        return {**season_report(load_season(year, league_id)), "final": False}

    key = f'derived/{league_id}/{year}/season-report-v{REPORT_VERSION}.json'
    try:
        stored = s3.get_object(Bucket=CACHE_BUCKET, Key=key)
        return {**json.loads(stored['Body'].read()), "final": True}
    except ClientError as e:
        if e.response['Error']['Code'] != 'NoSuchKey':
            raise

    result = season_report(load_season(year, league_id))
    try:
        s3.put_object(Bucket=CACHE_BUCKET, Key=key, Body=json.dumps(result),
                      ContentType='application/json')
        print(f"Stored {key}")
    except Exception as e:
        print(f"Failed to store {key}: {e}")
    return {**result, "final": True}


@espn_handler
def lambda_handler(event, context):
    params = event["queryStringParameters"]
    return report(params["leagueId"], params.get("year"))
