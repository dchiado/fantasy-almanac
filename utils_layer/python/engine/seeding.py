"""Playoff seeding: ESPN's rules for turning records into seeds.

The rules, as observed (checked with scripts/check_seeding.py):

1. Each division's winner is seeded first, best record first.
2. Every other team follows, best record first.
3. Ties, including ties for a division, go to the league's tiebreaker
   (playoffSeedingRule).

Seeds cover every team, not only playoff teams, so ESPN's playoffSeed can be
checked for the whole league. The top playoff_team_count seeds make the playoffs.
"""


class UnsupportedSeedingRule(ValueError):
    """The league breaks ties with a rule we haven't implemented and checked."""


def seed_teams(records, seeding_rule):
    """Order teams by playoff seed.

    Args:
        records: Records (engine.season.Record), one per team
        seeding_rule: ESPN's playoffSeedingRule, e.g. 'TOTAL_POINTS_SCORED'

    Returns:
        list of team ids, seed 1 first
    """
    key = _ranking_key(seeding_rule)

    divisions = {}
    for record in records:
        divisions.setdefault(record.division_id, []).append(record)
    winners = sorted((min(teams, key=key) for teams in divisions.values()), key=key)

    winner_ids = {r.team_id for r in winners}
    rest = sorted((r for r in records if r.team_id not in winner_ids), key=key)
    return [r.team_id for r in winners + rest]


def _ranking_key(seeding_rule):
    """Sort key that puts the better team first."""
    if seeding_rule == 'TOTAL_POINTS_SCORED':
        # Team id last only so results are stable; ESPN's final fallback is unknown
        return lambda r: (-r.win_pct, -r.points_for, r.team_id)
    # Head-to-head and division-record tiebreakers need more than one record at a
    # time. Add them when a league that uses one can be checked against ESPN.
    raise UnsupportedSeedingRule(seeding_rule)
