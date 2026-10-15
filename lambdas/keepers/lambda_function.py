import json
import datetime
from utils import latest_season, load_data, espn_handler


def keeper_options(league_id):
    """Assemble keeper options for each team based on keeper rules.

    Keepers must be acquired before the trade deadline and can be kept two
    rounds higher than their draft round. This is a Gridiron specific rule
    and wouldn't apply for other leagues.

    Returns:
        all_rosters (list) -- all teams and possible keepers with round
        [
            {
                "team_name": "Fantasy Football Team",
                "players": [
                    {
                        "name": "Jonathan Taylor",
                        "acq_type": "DRAFT",
                        "keeper_round": 1
                    },
                    {...}
                ]
            },
            {...}
        ]
    """
    year = latest_season(league_id)
    next_year_rounds = 16

    rosters = load_data(year, 'mRoster', league_id)
    draft = load_data(year, 'mDraftDetail', league_id)
    teams = load_data(year, 'mTeam', league_id)
    settings = load_data(year, 'mSettings', league_id)
    deadline = settings["settings"]["tradeSettings"]["deadlineDate"]

    all_rosters = []
    for team in teams["teams"]:
        team_roster_details = {}
        team_roster_details["team_name"] = team["name"]
        team_roster_details["players"] = []

        team_id = team["id"]
        for roster in rosters["teams"]:
            if roster["id"] == team_id:
                team_roster = roster["roster"]
                break

        for player in team_roster["entries"]:
            player_details = {
                "name": player["playerPoolEntry"]["player"]["fullName"],
                "acq_type": player["acquisitionType"],
                "acq_datetime": player["acquisitionDate"],
                "acq_before_deadline": player["acquisitionDate"] < deadline,
                "years_kept": 1  # NEW
            }

            # if player["acquisitionDate"] and player["acquisitionDate"] > deadline:
            #     continue

            draft_round = 'FA'
            player_id = player["playerPoolEntry"]["player"]["id"]

            # player_details["name"] = (
            #     player["playerPoolEntry"]["player"]["fullName"]
            # )
            # player_details["acq_type"] = player["acquisitionType"]

            for pick in draft["draftDetail"]["picks"]:
                if pick["playerId"] == player_id:
                    draft_round = pick["roundId"]
                    break

            player_details["draft_round"] = draft_round

            # back compat
            if draft_round in (1, 2):
                player_details["keeper_round"] = 1
            elif draft_round == 'FA':
                player_details["keeper_round"] = next_year_rounds - 1
            else:
                player_details["keeper_round"] = draft_round - 2

            team_roster_details["players"].append(player_details)

        all_rosters.append(team_roster_details)

    return all_rosters

@espn_handler
def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    return keeper_options(league_id)
