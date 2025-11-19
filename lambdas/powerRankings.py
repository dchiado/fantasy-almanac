import json
from utils import (
    is_bye_week,
    latest_season,
    load_data,
    number_of_weeks,
    team_mapping
)
import statistics
import boto3
import os

BUCKET_NAME = 'ffalmanac-data'


def update_overall_wins(tm, all_week_pts):
    """Calculate overall wins in the week and add to overall."""
    if 'overall_wins' not in tm:
        tm["overall_wins"] = 0
    for idx, s in enumerate(tm["scores"]):
        week_overall_wins = sorted(all_week_pts[idx + 1]).index(s)
        tm["overall_wins"] += week_overall_wins


def invoke_writeup_lambda(payload):
    import boto3
    lambda_client = boto3.client('lambda')
    lambda_client.invoke(
        FunctionName='writePowerRankings',
        InvocationType='Event',
        Payload=json.dumps(payload)
    )


def check_rankings_cache(league_id, year, week):
    s3 = boto3.client('s3')
    try:
        key = f"power_rankings/league_{league_id}/{year}/week_{week}/rankings.md"
        response = s3.get_object(Bucket=BUCKET_NAME, Key=key)
        llm_output = response['Body'].read().decode('utf-8')
        return {
            'status': 'success',
            'writeup': llm_output
        }
    except s3.exceptions.NoSuchKey:
        return {
            'status': 'not_found',
            'message': 'No cached LLM output for this week/league.'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }

def current(league_id):
    """Calculate current power rankings.

    The return object is a list of the teams objects definedbelow.
    The "games" list has True for a win, False for a loss.

    Returns:
        teams (object) -- OrderedDict of power ranking details
        [
            {
                "name": "Josh Allen",
                "team_id": 15,
                "scores": [158.9, 150.16],
                "against": [141.1, 99.8],
                "matchups: {
                    "score": <my score>,
                    "opponent_score": <their score>,
                    "opponent": <their team name>,
                    "result": "w" | "l"
                },
                "games": [True, True],
                "wins": 2,
                "l5": 2,
                "points": 309.06,
                "consistency": 4.37,
                "overall_wins": 20,
            },
            {...}
        ]
    """
    teams = []
    year = latest_season(league_id)

    matchups_resp = load_data(year, 'mMatchupScore', league_id)
    matchups = matchups_resp["schedule"]
    current_week = matchups_resp["scoringPeriodId"]

    weeks = number_of_weeks(year, False, league_id)
    if weeks == 0:
        return {"error": "No weeks in this season"}

    team_names = team_mapping(year, league_id)

    all_week_pts = {}
    # loop through all matchups in the regular season
    for matchup in matchups:
        week = matchup["matchupPeriodId"]
        if week > weeks or week > current_week:
            break

        if is_bye_week(matchup):
            continue

        if week not in all_week_pts:
            all_week_pts[week] = []

        # add team's score and win/loss to teams obj
        for t in ["home", "away"]:
            t_id = matchup[t]["teamId"]
            pts = matchup[t]["totalPoints"]
            won = matchup["winner"].lower() == t
            all_week_pts[week].append(pts)

            # get points against
            other = t == "home" and "away" or "home"
            against = matchup[other]["totalPoints"]

            # build "matchup" obj
            matchup_obj = {
                "week": week,
                "score": pts,
                "opponent_score": against,
                "opponent": team_names[matchup[other]["teamId"]],
                "result": pts > against and "w" or "l"
            }

            team_obj = next((x for x in teams if x["team_id"] == t_id), None)
            if team_obj is None:
                teams.append({
                    "name": team_names[t_id],
                    "team_id": t_id,
                    "scores": [pts],
                    "against": [against],
                    "games": [won],
                    "matchups": [matchup_obj]
                })
            else:
                team_obj["scores"].append(pts)
                team_obj["games"].append(won)
                team_obj["against"].append(against)
                team_obj["matchups"].append(matchup_obj)

    all_wins = []
    all_overall_wins = []
    all_l5 = []
    all_pts = []
    all_consistency = []

    # loop through each week to calculate the median score
    medians = {}
    for week in all_week_pts:
        medians[week] = statistics.median(all_week_pts[week])

    # loop through teams object and add sum values
    # to teams object and all_ lists
    for tm in teams:
        tm["wins"] = sum(tm["games"])
        all_wins.append(tm["wins"])

        tm["l5"] = sum(tm["games"][-5:])
        tm["wins_last_5"] = sum(tm["games"][-5:]) # better label for llm
        all_l5.append(tm["l5"])

        tm["points"] = round(sum(tm["scores"]), 2)
        all_pts.append(tm["points"])

        tm["consistency"] = round(statistics.pstdev(tm["scores"]), 2)
        all_consistency.append(tm["consistency"])

        update_overall_wins(tm, all_week_pts)
        all_overall_wins.append(tm["overall_wins"])

        # these don't have all_ lists because they're not used for sorting
        tm["avg_score"] = round(statistics.mean(tm["scores"]), 2)
        tm["avg_against"] = round(statistics.mean(tm["against"]), 2)
        tm["booms"] = sum([x > 140 for x in tm["scores"]])
        tm["busts"] = sum([x < 90 for x in tm["scores"]])
        tm["median_wins"] = 0
        for idx, s in enumerate(tm["scores"]):
            if s > medians[idx + 1]:
                tm["median_wins"] += 1

    # rank each data point in all_ lists properly
    all_wins_sorted = sorted(all_wins, reverse=True)
    all_l5_sorted = sorted(all_l5, reverse=True)
    all_pts_sorted = sorted(all_pts, reverse=True)
    all_consistency_sorted = sorted(all_consistency)  # ascending
    all_overall_wins_sorted = sorted(all_overall_wins, reverse=True)

    for tm in teams:
        wins_rank = all_wins_sorted.index(tm["wins"]) + 1
        l5_rank = all_l5_sorted.index(tm["l5"]) + 1
        pts_rank = all_pts_sorted.index(tm["points"]) + 1
        consistency_rank = all_consistency_sorted.index(tm["consistency"]) + 1
        overall_wins_rank = all_overall_wins_sorted.index(tm["overall_wins"]) + 1

        weights = {"wins": 3, "l5": 1, "points": 2, "consistency": 1, "overall_wins": 1}
        weights_sum = sum(weights.values())

        tm["pr_score"] = round(
            (wins_rank * weights["wins"] +
            l5_rank * weights["l5"] +
            pts_rank * weights["points"] +
            consistency_rank * weights["consistency"] +
            overall_wins_rank * weights["overall_wins"]) / weights_sum, 2
        )

    # sort ascending like the frontend
    teams = sorted(teams, key=lambda x: x["pr_score"])

    # check s3 for cached llm output
    cache_result = check_rankings_cache(league_id, year, current_week)
    if cache_result['status'] == 'success':
        return {
            "teams": teams,
            "writeup": cache_result['writeup']
        }
    else:
        # call other lambda to write up
        invoke_writeup_lambda({
            "year": year,
            "week": current_week,
            "league_id": league_id,
            "teams": teams
        })
        return {
            "teams": teams,
            "writeup": None
        }


def lambda_handler(event, context):
    league_id = event["queryStringParameters"]["leagueId"]
    return current(league_id)
