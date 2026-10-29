"""Tests for engine.lineups. Run from the repo root:

    python3 -m unittest discover tests
"""
import unittest

from test_engine import matchup, views  # also puts utils_layer/python on the path

from engine.lineups import (  # noqa: E402
    best_lineup, bench_blunders, lineup_efficiency, lineup_weeks, lineups_inputs, most_left, season_lineups,
)
from engine.recap import week_games  # noqa: E402
from engine.season import parse_season  # noqa: E402

# lineupSlotIds
QB, RB, RB_WR, WR, TE, FLEX, OP, DST, K, BENCH, IR = 0, 2, 3, 4, 6, 23, 7, 16, 17, 20, 21
ELIGIBLE = {'QB': [QB, OP], 'RB': [RB, RB_WR, FLEX, OP], 'WR': [WR, RB_WR, FLEX, OP],
            'TE': [TE, FLEX, OP], 'D/ST': [DST], 'K': [K]}

# Gridiron's lineup
GRIDIRON = {QB: 1, RB: 2, RB_WR: 1, WR: 2, TE: 1, DST: 1, K: 1}


def player(player_id, position, points, slot=BENCH):
    return {"player_id": player_id, "name": f"Player {player_id}", "position": position, "slot": slot,
            "eligible_slots": ELIGIBLE[position] + [BENCH, IR], "starter": slot not in (BENCH, IR),
            "points": points}


def total(players):
    return round(sum(p["points"] for p in players), 2)


def ids(players):
    return sorted(p["player_id"] for p in players)


class BestLineupTest(unittest.TestCase):
    def test_flex_takes_the_best_left_over(self):
        players = [player(1, 'RB', 20), player(2, 'RB', 15), player(3, 'RB', 12),
                   player(4, 'WR', 18), player(5, 'WR', 10), player(6, 'WR', 11)]
        best = best_lineup(players, {RB: 2, WR: 2, RB_WR: 1})
        self.assertEqual(ids(best), [1, 2, 3, 4, 6])

    def test_overlapping_flexes(self):
        # Greedy slot by slot would put the TE in FLEX and leave the WR/TE-only
        # slot to the 5-point WR; the best lineup moves the RB into FLEX instead.
        WR_TE = 5
        players = [player(1, 'TE', 30), player(2, 'RB', 25), player(3, 'WR', 5)]
        players[0]["eligible_slots"] = [WR_TE, FLEX]
        players[1]["eligible_slots"] = [FLEX]
        best = best_lineup(players, {FLEX: 1, WR_TE: 1})
        self.assertEqual(ids(best), [1, 2])

    def test_a_negative_defense_still_starts(self):
        players = [player(1, 'D/ST', -2), player(2, 'QB', 20)]
        self.assertEqual(ids(best_lineup(players, {QB: 1, DST: 1})), [1, 2])

    def test_the_better_of_two_bad_defenses(self):
        players = [player(1, 'D/ST', -2, DST), player(2, 'D/ST', -5)]
        self.assertEqual(ids(best_lineup(players, {DST: 1})), [1])

    def test_superflex(self):
        players = [player(1, 'QB', 25), player(2, 'QB', 22), player(3, 'RB', 15)]
        self.assertEqual(ids(best_lineup(players, {QB: 1, OP: 1})), [1, 2])

    def test_an_empty_slot_nobody_can_fill(self):
        self.assertEqual(ids(best_lineup([player(1, 'QB', 20)], {QB: 1, K: 1})), [1])

    def test_equal_points_keeps_the_starter(self):
        players = [player(1, 'RB', 10), player(2, 'RB', 10, RB)]
        self.assertEqual(ids(best_lineup(players, {RB: 1})), [2])


def team(*players):
    return {p["player_id"]: p for p in players}


class EfficiencyTest(unittest.TestCase):
    def test_points_left_and_swaps(self):
        week = {1: team(player(1, 'QB', 20, QB), player(2, 'RB', 4, RB), player(3, 'RB', 19),
                        player(4, 'RB', 30, IR))}
        result = lineup_efficiency([week], {QB: 1, RB: 1})[1]
        self.assertEqual((result["points"], result["best_points"], result["left"]), (24, 39, 15))
        self.assertEqual(ids(result["should_have_started"]), [3])
        self.assertEqual(ids(result["should_have_sat"]), [2])

    def test_an_empty_slot_counts_as_left(self):
        week = {1: team(player(1, 'QB', 20, QB), player(2, 'K', 8))}
        self.assertEqual(lineup_efficiency([week], {QB: 1, K: 1})[1]["left"], 8)

    def test_two_scoring_periods_add_up(self):
        first = {1: team(player(1, 'RB', 10, RB), player(2, 'RB', 15))}
        second = {1: team(player(1, 'RB', 12), player(2, 'RB', 8, RB))}
        result = lineup_efficiency([first, second], {RB: 1})[1]
        self.assertEqual((result["points"], result["best_points"], result["left"]), (18, 27, 9))

    def test_unknown_slots(self):
        self.assertEqual(lineup_efficiency([{1: team(player(1, 'QB', 20, QB))}], {}), {})


def efficiency(**left):
    """team id -> a lineup that left that many points on the bench."""
    return {int(t[1:]): {"points": 0, "best_points": n, "left": n, "should_have_started": [],
                         "should_have_sat": []} for t, n in left.items()}


def season(schedule, regular_weeks=2):
    return parse_season(1, 2025, views(schedule, regular_weeks=regular_weeks))


class BlundersTest(unittest.TestCase):
    # 1 beats 2 by 5, 3 beats 4 by 10
    WEEK = [matchup(1, 1, 130, 2, 125), matchup(1, 3, 90, 4, 80)]

    def test_every_team_that_would_have_won(self):
        games = week_games(season(self.WEEK), 1)
        found = bench_blunders(games, efficiency(t1=40, t2=6, t3=0, t4=12))
        self.assertEqual([(b["team_id"], b["best_points"]) for b in found], [(4, 92), (2, 131)])

    def test_against_the_opponents_actual_score(self):
        # Team 2's best (131) beats team 1's 130, though team 1's best is far higher
        games = week_games(season(self.WEEK), 1)
        self.assertEqual([b["team_id"] for b in bench_blunders(games, efficiency(t1=50, t2=6))], [2])

    def test_exactly_the_margin_is_a_tie_not_a_win(self):
        games = week_games(season(self.WEEK), 1)
        self.assertEqual(bench_blunders(games, efficiency(t2=5)), [])

    def test_most_left(self):
        games = week_games(season(self.WEEK), 1)
        self.assertEqual(most_left(games, efficiency(t1=3, t2=7, t3=1, t4=0))["team_id"], 2)
        self.assertIsNone(most_left(games, efficiency(t1=0, t2=0, t3=0, t4=0)))


class SeasonTest(unittest.TestCase):
    def test_totals_and_records(self):
        s = season([
            matchup(1, 1, 130, 2, 125), matchup(1, 3, 90, 4, 80),
            matchup(2, 1, 100, 3, 100, winner='TIE'), matchup(2, 2, 110, 4, 95),
            matchup(3, 1, 120, 2, 0, tier='WINNERS_BRACKET', winner='UNDECIDED'),
        ])
        self.assertEqual(list(lineup_weeks(s)), [1, 2])
        weeks = {1: efficiency(t1=0, t2=10, t3=0, t4=5), 2: efficiency(t1=4, t2=0, t3=0, t4=30)}
        result = season_lineups(s, weeks)
        by_team = {t["team_id"]: t for t in result["teams"]}

        self.assertEqual(result["weeks"], 2)
        self.assertEqual([t["team_id"] for t in result["teams"]][:2], [4, 2])
        self.assertEqual((by_team[4]["left"], by_team[4]["worst_week"]), (35, {"week": 2, "left": 30}))
        self.assertEqual(by_team[3]["perfect_weeks"], 2)

        # Team 2 lost week 1 by 5 and left 10; team 4 lost by 10 and left only 5
        self.assertEqual((by_team[2]["blunders"], by_team[2]["best_record"]),
                         (1, {"wins": 2, "losses": 0, "ties": 0}))
        self.assertEqual(by_team[4]["record"], {"wins": 0, "losses": 2, "ties": 0})
        self.assertEqual(by_team[4]["best_record"], {"wins": 1, "losses": 1, "ties": 0})
        # Team 1's tie would have been a win
        self.assertEqual(by_team[1]["best_record"], {"wins": 2, "losses": 0, "ties": 0})

    def test_inputs_ignore_undecided_weeks(self):
        played = [matchup(1, 1, 130, 2, 125), matchup(1, 3, 90, 4, 80)]
        before = lineups_inputs(season([*played, matchup(2, 1, 0, 2, 0, winner='UNDECIDED')]))
        during = lineups_inputs(season([*played, matchup(2, 1, 40, 2, 30, winner='UNDECIDED')]))
        corrected = lineups_inputs(season([matchup(1, 1, 131, 2, 125), played[1]]))
        self.assertEqual(before, during)
        self.assertNotEqual(before, corrected)


if __name__ == '__main__':
    unittest.main()
