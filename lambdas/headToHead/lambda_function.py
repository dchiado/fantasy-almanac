import json
from utils import (
    check_start_year,
    prefetch,
    espn_handler,
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

def add_scores(matchup, data, away_oid, home_oid, away_pts, home_pts, winners):
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


def all_time(owner_id_1, owner_id_2, league_id):
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

    end_year = latest_season(league_id)
    current_info = load_data(end_year, 'mNav', league_id)
    start_year = check_start_year(None, league_id)
    winners = []

    prefetch(league_id, range(start_year, end_year + 1), ['mSettings', 'mMatchupScore', 'mNav'])
    for year in range(start_year, end_year + 1):
        weeks = number_of_weeks(year, True, league_id)
        if weeks == 0:
            continue

        matchups = load_matchups(year, league_id)
        map_resp = load_data(year, 'mNav', league_id)
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

            add_scores(matchup, data, away_owner_id, home_owner_id,
                       away_pts, home_pts, winners)

    cstreak = current_streak(winners)
    lstreak = longest_streak(winners)
    data["current_streak"]["team"] = cstreak[0]
    data["current_streak"]["length"] = cstreak[1]
    data["longest_streak"]["team"] = lstreak[0]
    data["longest_streak"]["length"] = lstreak[1]

    return data


@espn_handler
def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    team1 = event["queryStringParameters"]["team1"]
    team2 = event["queryStringParameters"]["team2"]
    return all_time(team1, team2, league_id)