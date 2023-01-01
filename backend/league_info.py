import aiohttp
from utils import load_data, season_status


async def summary():
    """Assemble basic league information."""
    async with aiohttp.ClientSession() as http_session:
        status = await season_status(http_session)
        if "error" in status:
            return status

        year = status["season"]

        details = await load_data(year, 'mNav', http_session)

        name = details["settings"]["name"]
        est = details["status"]["previousSeasons"][0]
        teams = details["status"]["teamsJoined"]
        week = details["status"]["currentMatchupPeriod"]

        return {
            "name": name,
            "established": est,
            "teams": teams,
            "year": year,
            "week": week
        }
