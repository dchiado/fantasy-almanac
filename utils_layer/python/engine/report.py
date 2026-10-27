"""The season page's data, all in one response: teams and standings, playoff
odds by week, stretch-run scenarios, and luck. Plain dicts and lists, ready to
serialize as JSON."""
import hashlib
from dataclasses import replace

from .luck import luck, schedule_swap
from .scenarios import playoff_scenarios
from .season import records
from .seeding import UnsupportedSeedingRule, seed_teams
from .simulation import SIMULATIONS, completed_weeks, playoff_odds

# Bump when the output or any model behind it changes, so stored reports are
# recomputed (they're saved under a key that includes this)
REPORT_VERSION = 2


def season_report(season, simulations=SIMULATIONS):
    """Everything the season page shows, for games through the last completed week.

    If the league uses a seeding tiebreaker we don't support, seeds and playoff
    odds are None (with the rule in "unsupported_seeding_rule") rather than
    guessed, and teams are ordered by record and points."""
    week = completed_weeks(season)
    recs = records(season, week)
    try:
        order = seed_teams(recs.values(), season.settings.seeding_rule,
                           season.regular_season_games(week))
        supported = True
    except UnsupportedSeedingRule:
        order = sorted(recs, key=lambda t: (-recs[t].win_pct, -recs[t].points_for))
        supported = False

    teams = []
    for seed, team_id in enumerate(order, start=1):
        team, record = season.teams[team_id], recs[team_id]
        teams.append({
            "team_id": team_id,
            "name": team.name,
            "abbrev": team.abbrev,
            "logo": team.logo,
            "owner_id": team.owner_id,
            "owner_name": team.owner_name,
            "division_id": team.division_id,
            "seed": seed if supported else None,  # ours, from records through `week`
            "final_rank": team.final_rank,  # ESPN's, once the playoffs are over
            "wins": record.wins,
            "losses": record.losses,
            "ties": record.ties,
            "points_for": round(record.points_for, 2),
            "points_against": round(record.points_against, 2),
        })

    return {
        "version": REPORT_VERSION,
        "year": season.year,
        "completed_weeks": week,
        "regular_season_weeks": season.settings.regular_season_weeks,
        "playoff_team_count": season.settings.playoff_team_count,
        "seeding_rule": season.settings.seeding_rule,
        "unsupported_seeding_rule": None if supported else season.settings.seeding_rule,
        "divisions": [{"id": i, "name": n} for i, n in season.settings.divisions.items()],
        "teams": teams,
        "playoff_odds": playoff_odds(season, simulations) if supported else None,
        # Only in the last weeks of the regular season. Scenarios treat every tie
        # as undecided, so they work with any tiebreaker.
        "scenarios": playoff_scenarios(season, week),
        "luck": luck(season, week),
        "schedule_swap": schedule_swap(season, week),
    }


def report_inputs(season):
    """A short hash of everything season_report reads, so a stored report can be
    reused until a game finishes or a team changes. Points in games still being
    played are left out: the report only uses decided games."""
    games = [g if g.decided else replace(g, home_points=0.0, away_points=0.0) for g in season.games]
    inputs = repr((REPORT_VERSION, season.settings, season.teams, games))
    return hashlib.sha256(inputs.encode()).hexdigest()[:16]
