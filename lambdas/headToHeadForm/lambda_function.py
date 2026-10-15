import json
from utils import (
    espn_handler,
    latest_season,
    load_data,
)

def options(league_id):
    """Get current team name and owner ID for all active teams.

    Returns:
        team_options (list) -- team name and owner ID for active teams
        [
            {
                "name": "Fantasy Football Team",
                "owner_id": "{ABCDEF-123456-ZYXWVUT}"
            },
            {...},
        ]
    """
    year = latest_season(league_id)
    teams_res = load_data(year, 'mNav', league_id)
    teams = teams_res["teams"]
    team_options = []
    for team in teams:
        team_options.append({
            "name": team["name"],
            "owner_id": team["owners"][0]
        })
    return team_options

@espn_handler
def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    return options(league_id)
