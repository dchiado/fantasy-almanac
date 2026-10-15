import json
import statistics
from utils import (
    espn_handler,
    check_end_year,
    is_bye_week,
    load_matchups,
    number_of_weeks,
    load_data,
    team_name,
    check_start_year
)


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


def calculate_season_average(season, all_seasons, league_average, std_dev):
    """Calculate season scoring average and difference with team"""
    team_average = season["average"]
    std_dev_away = (team_average - league_average) / std_dev
    season["league_average"] = league_average
    season["std_dev_away"] = round(std_dev_away, 2)

    all_seasons.append(season)


def best_and_worst_seasons(start_year, end_year, count, best, league_id):
    """Calculate best and worst seasons based on % diff from league average.

    Arguments:
        start_year (str or None) -- the first year to check
        end_year (str or None) -- the last year to check
        count (int) -- how many records to include
        best (bool) -- if True, return best seasons, else return worst

    Returns:
        resp (object) -- OrderedDict of best or worst seasons
        [
            {
                "year": 2011,
                "team_name": "Fantasy Football Team",
                "average": 97.92,
                "league_average": 76.42,
                "std_dev_away": 28.13
            },
            {...}
        ]
    """
    all_seasons_all_time = []

    start_year = check_start_year(start_year, league_id)
    end_year = check_end_year(end_year, league_id)

    for year in range(int(start_year), int(end_year) + 1):
        all_averages_this_year = []
        all_seasons_this_year = []

        season = load_data(year, 'mNav', league_id)
        current_year_teams = season["teams"]

        matchups = load_matchups(year, league_id)
        weeks = number_of_weeks(year, False, league_id)
        if weeks == 0:
            continue

        for team in current_year_teams:
            current_team_id = team["id"]
            current_team_name = team_name(current_team_id, season)

            total_points = 0

            for matchup in matchups:
                if matchup["matchupPeriodId"] > weeks:
                    break

                total_points += team_points(matchup, current_team_id)

            average_team_score = total_points / weeks
            all_seasons_this_year.append({
                    "year": year,
                    "team_name": current_team_name,
                    "average": round(average_team_score, 2)
                }
            )
            all_averages_this_year.append(round(average_team_score, 2))

        std_dev_this_year = statistics.stdev(all_averages_this_year)
        league_average = round(
            sum(all_averages_this_year) / len(all_averages_this_year), 2
        )

        for season in all_seasons_this_year:
            calculate_season_average(season,
                                     all_seasons_all_time,
                                     league_average,
                                     std_dev_this_year)

    sorted_top_seasons = sorted(
        all_seasons_all_time,
        key=lambda t: t['std_dev_away'],
        reverse=best
        )

    return sorted_top_seasons[0:count]


@espn_handler
def lambda_handler(event, context):
    params = event["queryStringParameters"]
    league_id = params.get('leagueId')
    best = params.get('bestworst') == 'best'
    count = int(params.get('count') or 10)
    start_year = params.get('startyear')
    end_year = params.get('endyear')
    return best_and_worst_seasons(start_year, end_year, count, best, league_id)