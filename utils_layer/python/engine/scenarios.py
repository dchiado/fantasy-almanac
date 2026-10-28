"""Playoff scenarios for the stretch run: who has clinched, who is out, and
what each team needs this week. See docs/season-engine.md.

Every combination of win/loss results for the remaining regular-season games
is checked. Points for those games are unknown, so any tie on record could
break either way: a team has clinched only if it's in even when it loses
every tie, and it's alive while it's in when it wins every tie. That's exact
when ties go to total points, and conservative for other tiebreakers (it may
miss a clinch that head-to-head guarantees, but never claims a false one).
"""
from bisect import bisect_left, bisect_right
from itertools import product

from .season import REGULAR, records

# Scenarios are worked out this many regular-season weeks from the end, or fewer
SCENARIO_WEEKS = 3


def playoff_scenarios(season, through_week):
    """Scenarios with games through `through_week` final, or None outside the
    last SCENARIO_WEEKS weeks of the regular season.

    Returns:
        {"week": 12,  # the week the conditions are about
         "weeks_left": 3,
         "teams": [{"team_id", "status", "clinch", "eliminate"}, ...]}

        status: "clinched", "eliminated", "win_out" (in if it wins every
        remaining game) or "needs_help".
        clinch / eliminate: what makes that happen this week, or None if it
        can't. {"all": [condition, ...]} or {"any": [...]} with at most two
        conditions. When no statement that short is exact, "partial": True
        marks one that's enough on its own though there are other ways too,
        and {"complex": True} means there's no short statement at all.
        A condition is {"team_id", "result": "win" | "loss"}.
    """
    settings = season.settings
    weeks_left = settings.regular_season_weeks - through_week
    if not 1 <= weeks_left <= SCENARIO_WEEKS:
        return None

    team_ids = list(season.teams)
    index = {t: i for i, t in enumerate(team_ids)}
    base = records(season, through_week)
    remaining = [g for g in season.games
                 if g.tier == REGULAR and not g.is_bye
                 and through_week < g.week <= settings.regular_season_weeks]
    this_week = [g for g in remaining if g.week == through_week + 1]
    later = [g for g in remaining if g.week > through_week + 1]

    wins = [base[t].wins + base[t].ties / 2 for t in team_ids]
    games = [base[t].games for t in team_ids]
    for g in remaining:
        games[index[g.home]] += 1
        games[index[g.away]] += 1
    divisions = {}
    for t in team_ids:
        divisions.setdefault(season.teams[t].division_id, []).append(index[t])
    bounds = _Bounds(list(divisions.values()), settings.playoff_team_count)

    def outcome_pcts(results):
        """Final win percentages, given (home index, away index, home won) per game."""
        final = wins[:]
        for h, a, home_won in results:
            final[h if home_won else a] += 1
        return [w / g if g else 0.0 for w, g in zip(final, games)]

    pairs_now = [(index[g.home], index[g.away]) for g in this_week]
    pairs_later = [(index[g.home], index[g.away]) for g in later]
    n = len(team_ids)

    # Per this-week combination: who clinches (in, losing every tie, whatever
    # happens later) and who stays alive (in, winning every tie, somehow)
    clinches = []
    alive = []
    for now in product((True, False), repeat=len(pairs_now)):
        results_now = [(h, a, won) for (h, a), won in zip(pairs_now, now)]
        clinched = [True] * n
        still_alive = [False] * n
        pending = set(range(n))
        for after in product((True, False), repeat=len(pairs_later)):
            results = results_now + [(h, a, won) for (h, a), won in zip(pairs_later, after)]
            for i, (in_worst, in_best) in bounds.makes_playoffs(outcome_pcts(results), list(pending)):
                clinched[i] = clinched[i] and in_worst
                still_alive[i] = still_alive[i] or in_best
                if not clinched[i] and still_alive[i]:
                    pending.discard(i)  # neither can change now
            if not pending:
                break
        clinches.append(clinched)
        alive.append(still_alive)

    teams = []
    for t in team_ids:
        i = index[t]
        clinch_set = [c[i] for c in clinches]
        out_set = [not a[i] for a in alive]
        if all(clinch_set):
            status = "clinched"
        elif all(out_set):
            status = "eliminated"
        elif _in_if_wins_out(i, wins, games, remaining, index, bounds):
            status = "win_out"
        else:
            status = "needs_help"
        teams.append({
            "team_id": t,
            "status": status,
            "clinch": None if status == "clinched" else _condition(clinch_set, this_week, t, "loss"),
            "eliminate": None if status == "eliminated" else _condition(out_set, this_week, t, "win"),
        })

    return {"week": through_week + 1, "weeks_left": weeks_left, "teams": teams}


def _in_if_wins_out(i, wins, games, remaining, index, bounds):
    """Whether team i is in, losing every tie, whenever it wins all its remaining games."""
    own = [(index[g.home], index[g.away]) for g in remaining if i in (index[g.home], index[g.away])]
    others = [(index[g.home], index[g.away]) for g in remaining if i not in (index[g.home], index[g.away])]
    final_own = wins[:]
    for h, a in own:
        final_own[i] += 1
    for results in product((True, False), repeat=len(others)):
        final = final_own[:]
        for (h, a), home_won in zip(others, results):
            final[h if home_won else a] += 1
        pcts = [w / g if g else 0.0 for w, g in zip(final, games)]
        [(_, (in_worst, _))] = bounds.makes_playoffs(pcts, [i])
        if not in_worst:
            return False
    return True


def _condition(outcomes, this_week, team_id, rival_result):
    """The shortest statement of which this-week results lead to an outcome.

    outcomes[k] says whether the k-th combination of this week's results (in
    itertools.product((True, False), ...) order, True = home win) leads to it.
    Other teams' games are stated as a rival's `rival_result`: "loss" for
    clinching ("win AND Team X loss"), "win" for elimination.
    """
    count = len(outcomes)
    target = sum(1 << k for k, hit in enumerate(outcomes) if hit)
    if target == 0:
        return None

    # Each literal is one game's result, as a bitmask of the combinations it holds in
    literals = []
    for j, game in enumerate(this_week):
        home_won_mask = sum(1 << k for k in range(count)
                            if not (k >> (len(this_week) - 1 - j)) & 1)
        for home_won, mask in ((True, home_won_mask), (False, ~home_won_mask & ((1 << count) - 1))):
            literals.append((_literal(game, home_won, team_id, rival_result), mask))

    singles = [([lit], "all", mask) for lit, mask in literals]
    pairs = []
    for k, (lit1, mask1) in enumerate(literals):
        for lit2, mask2 in literals[k + 1:]:
            pairs.append(([lit1, lit2], "all", mask1 & mask2))
            pairs.append(([lit1, lit2], "any", mask1 | mask2))
    for lits, kind, mask in singles + pairs:
        if mask == target:
            return {kind: lits}

    # No exact short statement: offer the one covering the most results that's
    # still enough on its own, as long as it's possible at all
    enough = [(bin(mask).count("1"), -len(lits), lits, kind)
              for lits, kind, mask in singles + pairs if mask and mask & ~target == 0]
    if enough:
        _, _, lits, kind = max(enough, key=lambda e: e[:2])
        return {kind: lits, "partial": True}
    return {"complex": True}


def _literal(game, home_won, team_id, rival_result):
    """A game result as the team's own win or loss, or as the other game's
    winner's win or loser's loss, per `rival_result`."""
    winner, loser = (game.home, game.away) if home_won else (game.away, game.home)
    if team_id == winner:
        return {"team_id": team_id, "result": "win"}
    if team_id == loser:
        return {"team_id": team_id, "result": "loss"}
    if rival_result == "win":
        return {"team_id": winner, "result": "win"}
    return {"team_id": loser, "result": "loss"}


class _Bounds:
    """Whether a team makes the playoffs from final win percentages alone,
    if it loses every tie and if it wins every tie.

    Seeding puts division winners first, then everyone else (engine/seeding.py).
    How other teams' ties break doesn't change how many teams finish ahead of
    this one, so only its own ties matter.
    """

    def __init__(self, divisions, playoff_team_count):
        self.divisions = divisions
        self.division_of = {i: d for d, members in enumerate(divisions) for i in members}
        self.playoff_team_count = playoff_team_count

    def makes_playoffs(self, pcts, teams):
        """For each team index in `teams`: (i, (in when losing every tie,
        in when winning every tie))."""
        everyone = sorted(pcts)
        tops = [max(pcts[m] for m in members) for members in self.divisions]
        sorted_tops = sorted(tops)
        division_count = len(self.divisions)
        cutoff = self.playoff_team_count

        for i in teams:
            p = pcts[i]
            own = self.division_of[i]
            best_mate = max((pcts[m] for m in self.divisions[own] if m != i), default=-1.0)
            teams_above = len(everyone) - bisect_right(everyone, p)
            teams_at_or_above = len(everyone) - bisect_left(everyone, p) - 1  # not counting itself
            # Other divisions' winners, by their records
            tops_above = len(sorted_tops) - bisect_right(sorted_tops, p) - (tops[own] > p)
            tops_at_or_above = len(sorted_tops) - bisect_left(sorted_tops, p) - (tops[own] >= p)

            def seed(wins_ties):
                ahead = teams_above if wins_ties else teams_at_or_above
                tops_ahead = tops_above if wins_ties else tops_at_or_above
                if p > best_mate or (wins_ties and p == best_mate):
                    return 1 + tops_ahead  # division winner: only other winners can be ahead
                # Every division winner is ahead, plus the non-winners ahead on record
                return division_count + (ahead - tops_ahead - 1) + 1

            yield i, (seed(False) <= cutoff, seed(True) <= cutoff)
