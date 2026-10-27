"""Playoff seeding: ESPN's rules for turning records into seeds.

The rules, as observed (checked with scripts/check_seeding.py):

1. Each division's winner is seeded first, best record first.
2. Every other team follows, best record first.
3. Ties, including ties for a division, go to the league's tiebreaker
   (playoffSeedingRule):
   - TOTAL_POINTS_SCORED: more points for.
   - H2H_RECORD: with two tied teams, better record in games between them,
     then more points for. With three or more, the team with the most points
     goes first and the rest are compared again, so head-to-head only
     decides the last two.

Seeds cover every team, not only playoff teams, so ESPN's playoffSeed can be
checked for the whole league. The top playoff_team_count seeds make the playoffs.
"""
from itertools import groupby

SUPPORTED_RULES = ('TOTAL_POINTS_SCORED', 'H2H_RECORD')


class UnsupportedSeedingRule(ValueError):
    """The league breaks ties with a rule we haven't implemented and checked."""


def seed_teams(records, seeding_rule, games=()):
    """Order teams by playoff seed.

    Args:
        records: Records (engine.season.Record), one per team
        seeding_rule: ESPN's playoffSeedingRule, e.g. 'TOTAL_POINTS_SCORED'
        games: the decided games the records were built from (engine.season.Game).
            Only needed for H2H_RECORD.

    Returns:
        list of team ids, seed 1 first
    """
    if seeding_rule not in SUPPORTED_RULES:
        raise UnsupportedSeedingRule(seeding_rule)
    games = list(games)

    divisions = {}
    for record in records:
        divisions.setdefault(record.division_id, []).append(record)
    winners = _rank([_rank(teams, seeding_rule, games)[0] for teams in divisions.values()],
                    seeding_rule, games)

    winner_ids = {r.team_id for r in winners}
    rest = _rank([r for r in records if r.team_id not in winner_ids], seeding_rule, games)
    return [r.team_id for r in winners + rest]


def _rank(records, seeding_rule, games):
    """Order records best first: by win percentage, then the tiebreaker."""
    ranked = []
    by_pct = sorted(records, key=lambda r: -r.win_pct)
    for _pct, group in groupby(by_pct, key=lambda r: r.win_pct):
        ranked.extend(_break_tie(list(group), seeding_rule, games))
    return ranked


def _points_key(record):
    # Team id last only so results are stable; ESPN's final fallback is unknown
    return (-record.points_for, record.team_id)


def _break_tie(tied, seeding_rule, games):
    """Order teams with the same win percentage, best first."""
    if seeding_rule != 'H2H_RECORD' or len(tied) == 1:
        return sorted(tied, key=_points_key)
    if len(tied) == 2:
        pct = _head_to_head_pct({r.team_id for r in tied}, games)
        return sorted(tied, key=lambda r: (-pct[r.team_id],) + _points_key(r))
    # Three or more: head-to-head isn't used across the group. The most points
    # goes first, then the rest are compared again (down to two, which use it).
    first = min(tied, key=_points_key)
    return [first] + _break_tie([r for r in tied if r is not first], seeding_rule, games)


def _head_to_head_pct(team_ids, games):
    """Each team's win percentage in games against the others in team_ids.
    A team that hasn't played any of them counts as .500."""
    wins = dict.fromkeys(team_ids, 0.0)
    played = dict.fromkeys(team_ids, 0)
    for game in games:
        if game.home not in team_ids or game.away not in team_ids:
            continue
        for team_id in (game.home, game.away):
            played[team_id] += 1
            if game.winner is None:
                wins[team_id] += 0.5
            elif game.winner == team_id:
                wins[team_id] += 1
    return {t: wins[t] / played[t] if played[t] else 0.5 for t in team_ids}
