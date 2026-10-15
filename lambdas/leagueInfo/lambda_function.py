import json
from utils import load_data, season_status, espn_handler
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
CACHE_BUCKET = 'ffalmanac-data'

def summary(league_id):
    """Assemble basic league information."""
    status = season_status(league_id)
    if "error" in status:
        return status

    year = status["season"]

    details = load_data(year, 'mNav', league_id)

    name = details["settings"]["name"]
    est = details["status"]["previousSeasons"][0]
    teams = details["status"]["teamsJoined"]
    week = details["status"]["currentMatchupPeriod"]

    cached_data = s3.list_objects_v2(
        Bucket = CACHE_BUCKET,
        Prefix = f"espn-cache/{league_id}",
        MaxKeys = 1
    )
    is_cached = 'Contents' in cached_data

    return {
        "name": name,
        "established": est,
        "teams": teams,
        "year": year,
        "week": week,
        "cached": is_cached
    }

@espn_handler
def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    return summary(league_id)

