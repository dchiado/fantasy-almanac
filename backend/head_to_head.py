import aiohttp
from flask import session
from utils import (
    is_bye_week,
    latest_season,
    load_matchups,
    number_of_weeks,
    compare_lists,
    load_data,
    team_name,
    fantasy_team_logo,
    current_streak,
    longest_streak
)
from decimal import Decimal


async def options():
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
    async with aiohttp.ClientSession() as http_session:
        year = await latest_season(http_session)
        teams_res = await load_data(year, 'mNav', http_session)
        teams = teams_res["teams"]
        team_options = []
        for team in teams:
            team_options.append({
                "name": team["location"] + " " + team["nickname"],
                "owner_id": team["owners"][0]
            })
        return team_options


async def add_scores(matchup, data, away_oid, home_oid, away_pts, home_pts, winners):
    """Check the details of a matchup and add scores to data object.

    This is a helper for the all_time function.

    Arguments:
        matchup (object) -- the matchup object from mMatchupScore api
        data (object) -- the full data object from all_time function
        away_oid (str) -- the owner ID of the away team
        home_oid (str) -- the owner ID of the home team
        away_pts (float) -- points scored by away team
        home_pts (float) -- points scored by home team
        winners (list) -- array of winning teams for each matchup
    """
    if matchup["playoffTierType"] == "NONE":
        data[away_oid]["reg_points"] += away_pts
        data[home_oid]["reg_points"] += home_pts

        if away_pts > home_pts:
            winners.append(away_oid)
            data[away_oid]["reg_wins"] += 1
        elif away_pts < home_pts:
            winners.append(home_oid)
            data[home_oid]["reg_wins"] += 1
        elif away_pts == home_pts:
            data[away_oid]["reg_ties"] += 1
            data[home_oid]["reg_ties"] += 1

    elif matchup["playoffTierType"] == "WINNERS_BRACKET":
        data[away_oid]["playoff_points"] += away_pts
        data[home_oid]["playoff_points"] += home_pts

        if away_pts > home_pts:
            winners.append(away_oid)
            data[away_oid]["playoff_wins"] += 1
        elif away_pts < home_pts:
            winners.append(home_oid)
            data[home_oid]["playoff_wins"] += 1


async def all_time(owner_id_1, owner_id_2):
    """Calculate head to head stats all-time between two owners.

    This includes reg season wins, reg season points, ties, playoff wins,
    playoff points, longest streak, and current streak

    Need to use owner id for this function because some ids stayed the
    same through multiple owners over the years

    Arguments:
        owner_id_1 (str) -- the ID of the first owner
        owner_id_2 (str) -- the ID of the second owner

    Returns:
        all_records (list) -- blowouts and avg score by year
        [
            "owner_id": {
                "owner_id": "{ABCDEF-123456-GHIJKL}",
                "name": "Fantasy Football Team",
                "logo": "https://www.imgur.com/abcdef",
                "reg_wins": 12,
                "reg_ties": 0,
                "reg_points": 1200.24,
                "playoff_wins": 0,
                "playoff_points": 86.24,
            },
            "owner_id": {
                "owner_id": "{MNOPQR-789101-STUVWX}",
                "name": "Gruden Says",
                "logo": "https://www.espn.com/abcdef",
                "reg_wins": 9,
                "reg_ties": 0,
                "reg_points": 1096.54,
                "playoff_wins": 1,
                "playoff_points": 102.80,
            },
            "current_streak": {
                "team": "{MNOPQR-789101-STUVWX}",
                "length": 3
            },
            "longest_streak": {
                "team": "{MNOPQR-789101-STUVWX}",
                "length": 1
            }
        ]
    """
    async with aiohttp.ClientSession() as http_session:
        data = {
            owner_id_1: {
                "owner_id": owner_id_1,
                "reg_wins": 0,
                "reg_ties": 0,
                "reg_points": Decimal(0.00),
                "playoff_wins": 0,
                "playoff_points": Decimal(0.00),
            },
            owner_id_2: {
                "owner_id": owner_id_2,
                "reg_wins": 0,
                "reg_ties": 0,
                "reg_points": Decimal(0.00),
                "playoff_wins": 0,
                "playoff_points": Decimal(0.00),
            },
            "current_streak": {},
            "longest_streak": {}
        }

        end_year = await latest_season(http_session)
        current_info = await load_data(end_year, 'mNav', http_session)
        winners = []

        for year in range(session['start_year'], end_year + 1):
            weeks = await number_of_weeks(year, True, http_session)
            if weeks == 0:
                continue

            matchups = await load_matchups(year, http_session)
            map_resp = await load_data(year, 'mNav', http_session)
            team_owner_mapping = map_resp["teams"]

            for matchup in matchups:
                if matchup["matchupPeriodId"] > weeks:
                    break

                if is_bye_week(matchup):
                    continue

                away_details = matchup["away"]
                away_team_id = away_details["teamId"]
                away_owner_id = next(
                    item for item in team_owner_mapping
                    if item["id"] == away_team_id
                    )["owners"][0]

                home_details = matchup["home"]
                home_team_id = home_details["teamId"]
                home_owner_id = next(
                    item for item in team_owner_mapping
                    if item["id"] == home_team_id
                    )["owners"][0]

                right_teams = compare_lists([owner_id_1, owner_id_2],
                                            [away_owner_id, home_owner_id])
                if not right_teams:
                    continue

                # matchup be right
                away_pts = Decimal(str(away_details["totalPoints"]))
                home_pts = Decimal(str(home_details["totalPoints"]))

                data[away_owner_id]["name"] = team_name(away_team_id,
                                                        current_info)
                data[away_owner_id]["logo"] = fantasy_team_logo(away_team_id,
                                                                current_info)

                data[home_owner_id]["name"] = team_name(home_team_id,
                                                        current_info)
                data[home_owner_id]["logo"] = fantasy_team_logo(home_team_id,
                                                                current_info)

                await add_scores(matchup, data, away_owner_id, home_owner_id,
                           away_pts, home_pts, winners)

        cstreak = current_streak(winners)
        lstreak = longest_streak(winners)
        data["current_streak"]["team"] = cstreak[0]
        data["current_streak"]["length"] = cstreak[1]
        data["longest_streak"]["team"] = lstreak[0]
        data["longest_streak"]["length"] = lstreak[1]

        return data


async def record(owner_id_1, owner_id_2, http_session):
    """Calculate head to head record all-time between two owners.

    This function should be called from within an existing aiohttp session

    Need to use owner id for this function because some ids stayed the
    same through multiple owners over the years

    Arguments:
        owner_id_1 (str) -- the ID of the first owner
        owner_id_2 (str) -- the ID of the second owner
        http_session (ClientSession()) -- the aiohttp session for async invocation

    Returns:
        all_records (array) -- blowouts and avg score by year
        [
            {
                "owner_id": "{ABCDEF-123456-GHIJKL}",
                "wins": 5
            },
            {
                "owner_id": "{MNOPQR-789101-STUVWX}",
                "wins": 4
            }
        ]
    """
    data = {
        owner_id_1: {
            "owner_id": owner_id_1,
            "wins": 0,
        },
        owner_id_2: {
            "owner_id": owner_id_2,
            "wins": 0,
        },
    }

    end_year = await latest_season(http_session)

    for year in range(http_session['start_year'], end_year + 1):
        weeks = await number_of_weeks(year, True, http_session)
        if weeks == 0:
            continue

        matchups = await load_matchups(year, http_session)
        map_resp = await load_data(year, 'mNav', http_session)
        team_owner_mapping = map_resp["teams"]

        for matchup in matchups:
            if matchup["matchupPeriodId"] > weeks:
                break

            if is_bye_week(matchup):
                continue

            away_details = matchup["away"]
            away_team_id = away_details["teamId"]
            away_owner_id = next(
                item for item in team_owner_mapping
                if item["id"] == away_team_id
                )["owners"][0]

            home_details = matchup["home"]
            home_team_id = home_details["teamId"]
            home_owner_id = next(
                item for item in team_owner_mapping
                if item["id"] == home_team_id
                )["owners"][0]

            right_teams = compare_lists([owner_id_1, owner_id_2],
                                        [away_owner_id, home_owner_id])
            if not right_teams:
                continue

            # matchup be right
            if (
                matchup["playoffTierType"] == "NONE" or
                matchup["playoffTierType"] == "WINNERS_BRACKET"
            ):
                if matchup["winner"] == "AWAY":
                    data[away_owner_id]["wins"] += 1
                elif matchup["winner"] == "HOME":
                    data[home_owner_id]["wins"] += 1
    return [
        data[owner_id_1],
        data[owner_id_2],
    ]
