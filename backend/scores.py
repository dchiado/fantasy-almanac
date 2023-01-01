import aiohttp
import statistics
from utils import (
    check_end_year,
    is_bye_week,
    load_matchups,
    number_of_weeks,
    load_data,
    team_name,
    check_start_year
)


async def best_and_worst_weeks(start_year, end_year, playoffs, count, highest):
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
    async with aiohttp.ClientSession() as http_session:
        all_scores = []
        start_year = await check_start_year(start_year, http_session)
        end_year = await check_end_year(end_year, http_session)

        for year in range(start_year, end_year + 1):
            weeks = await number_of_weeks(year, playoffs, http_session)
            if weeks == 0:
                continue

            matchups = await load_matchups(year, http_session)
            season = await load_data(year, 'mNav', http_session)

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


def calculate_season_average(season, all_seasons, league_average, std_dev):
    """Calculate season scoring average and difference with team"""
    team_average = season["average"]
    std_dev_away = (team_average - league_average) / std_dev
    season["league_average"] = league_average
    season["std_dev_away"] = round(std_dev_away, 2)

    all_seasons.append(season)


async def best_and_worst_seasons(start_year, end_year, count, best):
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
    async with aiohttp.ClientSession() as http_session:
        all_seasons_all_time = []

        start_year = await check_start_year(start_year, http_session)
        end_year = await check_end_year(end_year, http_session)

        for year in range(int(start_year), int(end_year) + 1):
            all_averages_this_year = []
            all_seasons_this_year = []

            season = await load_data(year, 'mNav', http_session)
            current_year_teams = season["teams"]

            matchups = await load_matchups(year, http_session)
            weeks = await number_of_weeks(year, False, http_session)
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
