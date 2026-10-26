import json
import statistics
from utils import (
    prefetch,
    espn_handler,
    check_end_year,
    is_bye_week,
    load_matchups,
    number_of_weeks,
    load_data,
    team_name,
    check_start_year
)


def best_and_worst_weeks(start_year, end_year, playoffs, count, highest, league_id):
    """Calculate best and worst weeks in league history.

    Arguments:
        start_year (str or None) -- the first year to check
        end_year (str or None) -- the last year to check
        playoffs (bool) -- whether or not to include playoffs
        count (int) -- how many records to include
        highest (bool) -- if True, return highest scores, else return lowest

    Returns:
        resp (list) -- List of highest or lowest scores
        [
            {
                "year": 2020,
                "week": 4,
                "team_name": "Fantasy Football Team",
                "score": 210.08
            },
            {...}
        ]
    """
    all_scores = []
    start_year = check_start_year(start_year, league_id)
    end_year = check_end_year(end_year, league_id)

    prefetch(league_id, range(start_year, end_year + 1), ['mSettings', 'mMatchupScore', 'mNav'])
    for year in range(start_year, end_year + 1):
        weeks = number_of_weeks(year, playoffs, league_id)
        if weeks == 0:
            continue

        matchups = load_matchups(year, league_id)
        season = load_data(year, 'mNav', league_id)

        for matchup in matchups:
            week = 0
            if matchup["matchupPeriodId"] > weeks:
                break

            if is_bye_week(matchup):
                continue

            away_team_id = matchup["away"]["teamId"]
            if season["seasonId"] == year:
                away_team_name = team_name(away_team_id, season)

            away_score = matchup["away"]["totalPoints"]
            week = matchup["matchupPeriodId"]
            away_game = {
                "year": year,
                "week": week,
                "team_name": away_team_name,
                "score": away_score
            }
            all_scores.append(away_game)

            home_team_id = matchup["home"]["teamId"]
            if season["seasonId"] == year:
                home_team_name = team_name(home_team_id, season)

            home_score = matchup["home"]["totalPoints"]
            week = matchup["matchupPeriodId"]
            home_game = {
                "year": year,
                "week": week,
                "team_name": home_team_name,
                "score": home_score
            }
            all_scores.append(home_game)

    sorted_scores = sorted(
        all_scores,
        key=lambda s: s['score'],
        reverse=highest
        )

    return sorted_scores[0:count]


def team_points(matchup, team_id):
    """Find points scored by the correct team_id"""
    if is_bye_week(matchup):
        return 0

    if matchup["away"]["teamId"] == team_id:
        return matchup["away"]["totalPoints"]
    elif matchup["home"]["teamId"] == team_id:
        return matchup["home"]["totalPoints"]
    else:
        return 0


@espn_handler
def lambda_handler(event, context):
    params = event["queryStringParameters"]
    league_id = params.get('leagueId')
    best = params.get('bestworst') == 'best'
    playoffs = params.get('playoffs') == True
    count = int(params.get('count') or 10)
    start_year = params.get('startyear')
    end_year = params.get('endyear')
    return best_and_worst_weeks(start_year, end_year, playoffs, count, best, league_id)