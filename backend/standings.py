import aiohttp
from utils import load_data, latest_season

async def list():
    """Calculate league standings by year and overall for all years.

    Returns:
        all_records (object) -- blowouts and avg score by year
        {
            "seasons": [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013,
                        2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
            "teams": [
                {
                    "name": "Joe Blow",
                    "seasons": [
                        {
                            "year": 2005,
                            "wins": 8,
                            "losses": 5,
                            "ties": 0,
                            "reg_season_champ": False,
                            "playoff_champ": False,
                            "toilet_bowl": False
                        },
                        {...}
                    ]
                },
                {...}
            ]
        }
    """
    async with aiohttp.ClientSession() as http_session:
        all_records = {
            "seasons": [],
            "teams": []
        }

        end_year = await latest_season(http_session)
        details = await load_data(end_year, 'mNav', http_session)
        start_year = details["status"]["previousSeasons"][0]

        for year in range(int(start_year), int(end_year) + 1):
            team_details = await load_data(year, 'mTeam', http_session)
            if team_details["status"]["currentMatchupPeriod"] == 1:
                continue

            all_records["seasons"].append(year)
            teams = team_details["teams"]
            owners = team_details["members"]

            for team in teams:
                record = team["record"]["overall"]
                reg_season_place = team["playoffSeed"]
                playoff_place = team["rankCalculatedFinal"]
                total_teams = team_details["status"]["teamsJoined"]

                owner_id = team["primaryOwner"]
                team_info = next(
                    (owner for owner in owners if owner["id"] == owner_id)
                    )
                fname = team_info["firstName"].strip().capitalize()
                lname = team_info["lastName"].strip().capitalize()
                owner = f'{fname} {lname}'

                season_wins = record["wins"]
                season_losses = record["losses"]
                season_ties = record["ties"]
                # season_pf = int(record["pointsFor"])
                # season_pa = int(record["pointsAgainst"])

                season_summary = {
                    "year": year,
                    "wins": season_wins,
                    "losses": season_losses,
                    "ties": season_ties,
                    "reg_season_champ": reg_season_place == 1,
                    "playoff_champ": playoff_place == 1,
                    "toilet_bowl": reg_season_place == total_teams
                }

                # check if this owner has entry in all_records
                obj = (
                    next((x for x in all_records["teams"] if x["name"] == owner), None) or # try to match on name
                    next((x for x in all_records["teams"] if x["id"] == owner_id), None) # use id in case name changed
                )
                if obj is not None:
                    obj["seasons"].append(season_summary)
                else:
                    all_records["teams"].append({
                        "name": owner,
                        "id": owner_id,
                        "seasons": [
                            season_summary
                        ]
                    })

        return all_records
