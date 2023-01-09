import aiohttp
from utils import latest_season, load_data


async def keeper_options():
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
    async with aiohttp.ClientSession() as http_session:
        year = await latest_season(http_session)
        next_year_rounds = 16

        rosters = await load_data(year, 'mRoster', http_session)
        draft = await load_data(year, 'mDraftDetail', http_session)
        teams = await load_data(year, 'mTeam', http_session)
        settings = await load_data(year, 'mSettings', http_session)
        deadline = settings["settings"]["tradeSettings"]["deadlineDate"]

        all_rosters = []
        for team in teams["teams"]:
            team_roster_details = {}
            team_name = str(team["location"] + " " + str(team["nickname"]))
            team_roster_details["team_name"] = team_name
            team_roster_details["players"] = []

            team_id = team["id"]
            for roster in rosters["teams"]:
                if roster["id"] == team_id:
                    team_roster = roster["roster"]
                    break

            for player in team_roster["entries"]:
                # cant keep players acquired after the deadline
                if player["acquisitionDate"] > deadline:
                    continue

                player_details = {}

                draft_round = 'FA'
                player_id = player["playerPoolEntry"]["player"]["id"]

                player_details["name"] = (
                    player["playerPoolEntry"]["player"]["fullName"]
                )
                player_details["acq_type"] = player["acquisitionType"]

                for pick in draft["draftDetail"]["picks"]:
                    if pick["playerId"] == player_id:
                        draft_round = pick["roundId"]
                        break

                if draft_round in (1, 2):
                    player_details["keeper_round"] = 1
                elif draft_round == 'FA':
                    player_details["keeper_round"] = next_year_rounds - 1
                else:
                    player_details["keeper_round"] = draft_round - 2

                team_roster_details["players"].append(player_details)

            all_rosters.append(team_roster_details)

        return all_rosters
