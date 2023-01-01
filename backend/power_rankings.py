from utils import (
    is_bye_week,
    latest_season,
    load_data,
    number_of_weeks,
    team_mapping
)
import statistics
import aiohttp


def update_overall_wins(tm, all_week_pts):
    """Calculate overall wins in the week and add to overall."""
    if 'overall_wins' not in tm:
        tm["overall_wins"] = 0
    for idx, s in enumerate(tm["scores"]):
        week_overall_wins = sorted(all_week_pts[idx + 1]).index(s)
        tm["overall_wins"] += week_overall_wins


async def current():
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
    async with aiohttp.ClientSession() as http_session:
        teams = []
        year = await latest_season(http_session)

        matchups_resp = await load_data(year, 'mMatchupScore', http_session)
        matchups = matchups_resp["schedule"]
        current_week = matchups_resp["scoringPeriodId"]

        weeks = await number_of_weeks(year, False, http_session)
        if weeks == 0:
            return {"error": "No weeks in this season"}

        team_names = await team_mapping(year, http_session)

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

                team_obj = next((x for x in teams if x["team_id"] == t_id), None)
                if team_obj is None:
                    teams.append({
                        "name": team_names[t_id],
                        "team_id": t_id,
                        "scores": [pts],
                        "games": [won]
                    })
                else:
                    team_obj["scores"].append(pts)
                    team_obj["games"].append(won)

        all_wins = []
        all_overall_wins = []
        all_l5 = []
        all_pts = []
        all_consistency = []

        # loop through teams object and add sum values
        # to teams object and all_ lists
        for tm in teams:
            tm["wins"] = sum(tm["games"])
            all_wins.append(tm["wins"])

            tm["l5"] = sum(tm["games"][-5:])
            all_l5.append(tm["l5"])

            tm["points"] = round(sum(tm["scores"]), 2)
            all_pts.append(tm["points"])

            tm["consistency"] = round(statistics.pstdev(tm["scores"]), 2)
            all_consistency.append(tm["consistency"])

            update_overall_wins(tm, all_week_pts)
            all_overall_wins.append(tm["overall_wins"])

        # return list of teams objects
        return teams
