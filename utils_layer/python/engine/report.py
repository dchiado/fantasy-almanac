"""The season page's data, all in one response: teams and standings, playoff
odds by week, stretch-run scenarios, and luck. Plain dicts and lists, ready to
serialize as JSON."""
import hashlib
from dataclasses import replace

from .luck import luck, schedule_swap
from .scenarios import playoff_scenarios
from .season import SUPPORTED_BONUSES, last_played_week, records
from .seeding import UnsupportedSeedingRule, seed_teams
from .simulation import SIMULATIONS, completed_weeks, highlights as odds_highlights, playoff_odds

# Bump when the output or any model behind it changes, so stored reports are
# recomputed (they're saved under a key that includes this)
REPORT_VERSION = 5


def season_report(season, simulations=SIMULATIONS):
    """Everything the season page shows, for games through the last completed week.

    If the league uses a seeding tiebreaker or weekly bonus we don't support,
    seeds and playoff odds are None (with the rule in "unsupported_rule")
    rather than guessed, and teams are ordered by record and points.

    In a league without playoffs, the odds are of finishing first: the title."""
    settings = season.settings
    week = completed_weeks(season)
    recs = records(season, week)
    unsupported = None
    if settings.win_bonus not in SUPPORTED_BONUSES:
        unsupported = settings.win_bonus
    else:
        try:
            order = seed_teams(recs.values(), settings.seeding_rule, season.regular_season_games(week))
        except UnsupportedSeedingRule:
            unsupported = settings.seeding_rule
    supported = unsupported is None
    if not supported:
        order = sorted(recs, key=lambda t: (-recs[t].win_pct, -recs[t].points_for))

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

    odds = playoff_odds(season, simulations) if supported else None
    highlights = odds_highlights(season, odds["weeks"]) if odds else []
    if supported and settings.has_playoffs and week == settings.regular_season_weeks:
        highlights.append(_bubble(recs, order, settings.playoff_team_count))

    return {
        "version": REPORT_VERSION,
        "year": season.year,
        "completed_weeks": week,
        # Including the playoffs: the weeks with a recap (GET /recap)
        "weeks_played": last_played_week(season),
        "regular_season_weeks": settings.regular_season_weeks,
        # False when first place wins the title: the odds are then title odds
        "has_playoffs": settings.has_playoffs,
        "playoff_team_count": settings.playoff_team_count,
        "seeding_rule": settings.seeding_rule,
        "unsupported_rule": unsupported,
        "divisions": [{"id": i, "name": n} for i, n in settings.divisions.items()],
        "teams": teams,
        "playoff_odds": odds,
        # Collapse and comeback (engine/simulation.py) and the bubble, once the
        # regular season is over
        "highlights": highlights,
        # Only in the last weeks of the regular season. Scenarios treat every tie
        # as undecided, so they work with any tiebreaker.
        "scenarios": playoff_scenarios(season, week),
        "luck": luck(season, week),
        "schedule_swap": schedule_swap(season, week),
    }


def _bubble(recs, order, playoff_team_count):
    """The last team into the playoffs and the first team out, and what
    separated them: games, or (on equal records) the tiebreaker. games_ahead is
    negative when the last spot went to a division winner with a worse record."""
    last_in, first_out = recs[order[playoff_team_count - 1]], recs[order[playoff_team_count]]
    return {
        "type": "bubble",
        "team_id": last_in.team_id,
        "out_team_id": first_out.team_id,
        "games_ahead": (last_in.wins + last_in.ties / 2) - (first_out.wins + first_out.ties / 2),
        "points_ahead": round(last_in.points_for - first_out.points_for, 2),
    }


def report_inputs(season):
    """A short hash of everything season_report reads, so a stored report can be
    reused until a game finishes or a team changes. Points in games still being
    played are left out: the report only uses decided games."""
    games = [g if g.decided else replace(g, home_points=0.0, away_points=0.0) for g in season.games]
    inputs = repr((REPORT_VERSION, season.settings, season.teams, games))
    return hashlib.sha256(inputs.encode()).hexdigest()[:16]
