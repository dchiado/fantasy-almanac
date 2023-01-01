import collections
import aiohttp
from utils import (
    is_bye_week,
    load_matchups,
    number_of_weeks,
    check_start_year,
    check_end_year,
    load_data,
    team_name
)


async def results(start_year, end_year, playoffs, count, blowouts):
    """Calculate the biggest or smallest wins in league history.

    Arguments:
        start_year (str or None) -- the first year to check
        end_year (str or None) -- the last year to check
        playoffs (bool) -- whether or not to include playoffs
        count (int) -- how many records to include
        blowouts (bool) -- if True, return biggest wins, else return smallest

    Returns:
        resp (object) -- blowouts and avg score by year
        [
            {
                "year": 2018,
                "week": 4,
                "difference": 112.46,
                "winner": "Little Lebowski Urban Achievers",
                "loser": 'Laces Out!'
            },
            {...}
        ]
    """
    async with aiohttp.ClientSession() as session:
        all_matchups = []
        start_year = check_start_year(start_year)
        end_year = await check_end_year(end_year, session)

        for year in range(int(start_year), int(end_year) + 1):
            weeks = await number_of_weeks(year, playoffs, session)
            if weeks == 0:
                continue

            season = await load_data(year, 'mNav', session)
            matchups = await load_matchups(year, session)

            for _idx, matchup in enumerate(matchups):
                matchup_result = {}
                if matchup["matchupPeriodId"] > weeks:
                    break

                if is_bye_week(matchup) or matchup["playoffTierType"] == 'LOSERS_CONSOLATION_LADDER':
                    continue

                away_score = matchup["away"]["totalPoints"]
                away_team_id = matchup["away"]["teamId"]

                if season["seasonId"] == year:
                    away_team_name = team_name(away_team_id, season)

                home_score = matchup["home"]["totalPoints"]
                home_team_id = matchup["home"]["teamId"]

                if season["seasonId"] == year:
                    home_team_name = team_name(home_team_id, season)

                difference = 0
                if away_score > home_score:
                    difference = away_score - home_score
                    winner = away_team_name
                    loser = home_team_name
                else:
                    difference = home_score - away_score
                    winner = home_team_name
                    loser = away_team_name

                matchup_result["year"] = year
                matchup_result["week"] = matchup["matchupPeriodId"]
                matchup_result["difference"] = round(difference, 2)
                matchup_result["winner"] = winner
                matchup_result["loser"] = loser

                all_matchups.append(matchup_result)

        sorted_matchups = sorted(
            all_matchups,
            key=lambda t: t['difference'],
            reverse=blowouts
            )

        return sorted_matchups[0:count]
