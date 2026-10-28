from utils import load_data, season_phase, espn_handler
import boto3

s3 = boto3.client('s3')
CACHE_BUCKET = 'ffalmanac-data'

def summary(league_id):
    """Assemble basic league information."""
    phase = season_phase(league_id)
    if "error" in phase:
        return phase

    year = phase["season"]

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
        "phase": phase["phase"],
        "regular_season_weeks": phase["regular_season_weeks"],
        "regular_season_weeks_left": phase["regular_season_weeks_left"],
        "has_playoffs": phase["has_playoffs"],
        "cached": is_cached
    }

@espn_handler
def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    return summary(league_id)
