"""Tests for engine.scenarios. Run from the repo root:

    python3 -m unittest discover tests
"""
import random
import unittest
from itertools import product

from test_engine import matchup, views  # also puts utils_layer/python on the path

from engine.scenarios import _Bounds, _condition, playoff_scenarios  # noqa: E402
from engine.season import Game, Record, parse_season  # noqa: E402
from engine.seeding import seed_teams  # noqa: E402


def game(home, away):
    return Game(week=1, tier='regular', home=home, away=away, home_points=0.0, away_points=0.0,
                decided=False, winner=None)


class BoundsTest(unittest.TestCase):
    def test_matches_seeding_when_losing_or_winning_every_tie(self):
        """Losing every tie (lowest points) or winning every tie (highest) gives
        exactly what seed_teams does, for random leagues full of ties."""
        rng = random.Random(1)
        for _ in range(2000):
            n, divisions, cutoff = rng.choice([8, 10, 12]), rng.choice([1, 2, 3]), rng.choice([4, 6])
            division_of = [i % divisions for i in range(n)]
            wins = [rng.randint(4, 10) for _ in range(n)]
            bounds = _Bounds([[i for i in range(n) if division_of[i] == d] for d in range(divisions)], cutoff)
            results = dict(bounds.makes_playoffs([w / 14 for w in wins], range(n)))
            for i in range(n):
                for points, expected in ((-1.0, results[i][0]), (2.0, results[i][1])):
                    pts = [rng.random() for _ in range(n)]
                    pts[i] = points
                    recs = [Record(t, division_of[t], wins[t], 14 - wins[t], 0, pts[t]) for t in range(n)]
                    self.assertEqual(i in seed_teams(recs, 'TOTAL_POINTS_SCORED')[:cutoff], expected)


class ConditionTest(unittest.TestCase):
    """Team 1 plays 2 and team 3 plays 4 this week. Outcomes are listed in
    product((True, False), repeat=2) order: (1 wins, 3 wins), (1 wins, 4 wins),
    (2 wins, 3 wins), (2 wins, 4 wins)."""
    week = [game(1, 2), game(3, 4)]

    def condition(self, hits, rival_result="loss"):
        return _condition(hits, self.week, 1, rival_result)

    def test_shapes(self):
        win, rival_loss = {"team_id": 1, "result": "win"}, {"team_id": 3, "result": "loss"}
        self.assertIsNone(self.condition([False] * 4))
        self.assertEqual(self.condition([True, True, False, False]), {"all": [win]})
        self.assertEqual(self.condition([False, True, False, False]), {"all": [win, rival_loss]})
        self.assertEqual(self.condition([True, True, False, True]), {"any": [win, rival_loss]})

    def test_rivals_named_by_outcome(self):
        # Elimination conditions name the rival that wins
        self.assertEqual(self.condition([False, False, True, False], rival_result="win"),
                         {"all": [{"team_id": 1, "result": "loss"}, {"team_id": 3, "result": "win"}]})

    def test_partial_and_complex(self):
        # A third game (5 vs 6), so some outcome sets need three clauses
        week = self.week + [game(5, 6)]
        outcomes = list(product((True, False), repeat=3))
        # 1 wins and (3 or 5 wins), or 1 loses and both 3 and 5 win: no two-clause
        # statement is exact, but "win AND 4 loss" is always enough
        hits = [a and (b or c) or (not a and b and c) for a, b, c in outcomes]
        self.assertEqual(_condition(hits, week, 1, "loss"),
                         {"all": [{"team_id": 1, "result": "win"}, {"team_id": 4, "result": "loss"}], "partial": True})
        # An odd number of home wins: nothing short is exact or enough
        odd = [(a + b + c) % 2 == 1 for a, b, c in outcomes]
        self.assertEqual(_condition(odd, week, 1, "loss"), {"complex": True})


class ScenariosTest(unittest.TestCase):
    def season(self):
        """Four teams in one division, two make the playoffs, one week left.
        After two weeks: 1 is 2-0, 2 and 3 are 1-1, 4 is 0-2. Week 3: 1 vs 3, 2 vs 4."""
        schedule = [
            matchup(1, 1, 110, 4, 90), matchup(1, 2, 100, 3, 95),
            matchup(2, 1, 105, 2, 100), matchup(2, 3, 120, 4, 90),
            matchup(3, 1, 0, 3, 0, winner='UNDECIDED'), matchup(3, 2, 0, 4, 0, winner='UNDECIDED'),
        ]
        return parse_season(1, 2025, views(schedule, divisions={1: 0, 2: 0, 3: 0, 4: 0}, regular_weeks=3))

    def test_one_week_left(self):
        result = playoff_scenarios(self.season(), 2)
        self.assertEqual((result["week"], result["weeks_left"]), (3, 1))
        teams = {t["team_id"]: t for t in result["teams"]}
        # Losing to 3 while 2 wins makes a three-way tie at 2-1, which points decide
        self.assertEqual(teams[1]["status"], "win_out")
        self.assertEqual(teams[1]["clinch"], {"any": [{"team_id": 1, "result": "win"}, {"team_id": 2, "result": "loss"}]})
        self.assertIsNone(teams[1]["eliminate"])
        # 4 can only get in through a three-way tie at 1-2, so it can't clinch
        self.assertEqual(teams[4]["status"], "needs_help")
        self.assertIsNone(teams[4]["clinch"])
        self.assertEqual(teams[4]["eliminate"], {"any": [{"team_id": 3, "result": "win"}, {"team_id": 4, "result": "loss"}]})

    def test_only_in_the_last_weeks(self):
        self.assertIsNone(playoff_scenarios(self.season(), 3))  # season over
        self.assertIsNotNone(playoff_scenarios(self.season(), 0))  # three weeks left


if __name__ == '__main__':
    unittest.main()
