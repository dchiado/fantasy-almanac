"""Tests for engine.simulation and engine.luck. Run from the repo root:

    python3 -m unittest discover tests
"""
import json
import unittest

from test_engine import matchup, views  # also puts utils_layer/python on the path

from engine.luck import luck, schedule_swap  # noqa: E402
from engine.report import season_report  # noqa: E402
from engine.season import parse_season  # noqa: E402
from engine.simulation import completed_weeks, odds_after_week, playoff_odds  # noqa: E402


def round_robin_schedule(week3_played=True):
    """Four teams over three weeks. Team 1 wins every game, team 4 loses every game."""
    return [
        matchup(1, 1, 130, 2, 100), matchup(1, 3, 110, 4, 90),
        matchup(2, 1, 120, 3, 105), matchup(2, 2, 115, 4, 112),
        matchup(3, 1, 125, 4, 80) if week3_played else matchup(3, 1, 0, 4, 0, winner='UNDECIDED'),
        matchup(3, 2, 98, 3, 101) if week3_played else matchup(3, 2, 0, 3, 0, winner='UNDECIDED'),
    ]


def round_robin(week3_played=True):
    """round_robin_schedule as a season of three regular-season weeks; the top two make the playoffs."""
    return parse_season(1, 2025, views(round_robin_schedule(week3_played), regular_weeks=3))


class SimulationTest(unittest.TestCase):
    def test_completed_weeks(self):
        self.assertEqual(completed_weeks(round_robin()), 3)
        self.assertEqual(completed_weeks(round_robin(week3_played=False)), 2)

    def test_final_week_is_certain(self):
        odds = {t["team_id"]: t for t in odds_after_week(round_robin(), 3)["teams"]}
        # Division winners 1 (3-0) and 3 (2-1) are the top two seeds
        self.assertEqual([odds[t]["playoff_pct"] for t in (1, 2, 3, 4)], [1, 0, 1, 0])
        self.assertEqual(odds[1]["seed_dist"], [1, 0, 0, 0])
        self.assertEqual(odds[1]["avg_wins"], 3)

    def test_odds_add_up(self):
        for week in range(4):
            teams = odds_after_week(round_robin(), week, simulations=200)["teams"]
            self.assertAlmostEqual(sum(t["playoff_pct"] for t in teams), 2)
            self.assertAlmostEqual(sum(t["division_pct"] for t in teams), 2)
            for t in teams:
                self.assertAlmostEqual(sum(t["seed_dist"]), 1)

    def test_same_odds_every_time(self):
        season = round_robin()
        self.assertEqual(odds_after_week(season, 1, 200), odds_after_week(season, 1, 200))

    def test_current_season_stops_at_last_completed_week(self):
        odds = playoff_odds(round_robin(week3_played=False), simulations=50)
        self.assertEqual([w["week"] for w in odds["weeks"]], [0, 1, 2])


class ReportTest(unittest.TestCase):
    def test_report(self):
        report = season_report(round_robin(), simulations=50)
        self.assertEqual([t["team_id"] for t in report["teams"]], [1, 3, 2, 4])
        self.assertEqual(report["completed_weeks"], 3)
        self.assertEqual(len(report["playoff_odds"]["weeks"]), 4)
        json.dumps(report)  # must serialize

    def test_unsupported_tiebreaker_leaves_out_seeds_and_odds(self):
        season = parse_season(1, 2025, views(round_robin_schedule(), rule='INTRA_DIVISION_RECORD',
                                             regular_weeks=3))
        report = season_report(season, simulations=50)
        self.assertIsNone(report["playoff_odds"])
        self.assertEqual(report["unsupported_seeding_rule"], 'INTRA_DIVISION_RECORD')
        self.assertEqual([t["seed"] for t in report["teams"]], [None] * 4)
        self.assertEqual(len(report["luck"]), 4)


class LuckTest(unittest.TestCase):
    def test_all_play_and_expected_wins(self):
        teams = {t["team_id"]: t for t in luck(round_robin())}
        # Team 1 had the top score every week
        self.assertEqual((teams[1]["all_play_wins"], teams[1]["all_play_losses"]), (9, 0))
        self.assertEqual(teams[1]["expected_wins"], 3)
        # Team 2: 1-2, but outscored two teams in week 2 and one in weeks 1 and 3
        self.assertEqual(teams[2]["all_play_wins"], 4)
        self.assertEqual(teams[2]["luck"], round(1 - 4 / 3, 2))
        self.assertAlmostEqual(sum(t["luck"] for t in teams.values()), 0, places=1)

    def test_close_games(self):
        teams = {t["team_id"]: t for t in luck(round_robin())}
        # 115-112 in week 2 and 98-101 in week 3
        self.assertEqual((teams[2]["close_wins"], teams[2]["close_losses"]), (1, 1))
        self.assertEqual((teams[4]["close_wins"], teams[4]["close_losses"]), (0, 1))

    def test_schedule_swap(self):
        swap = schedule_swap(round_robin())
        grid = {(a, b): swap["records"][i][j]
                for i, a in enumerate(swap["team_ids"]) for j, b in enumerate(swap["team_ids"])}
        self.assertEqual(grid[(1, 1)], [3, 0, 0])  # actual record
        self.assertEqual(grid[(4, 4)], [0, 3, 0])
        # Team 4 on team 1's schedule: plays 2 (90 vs 100), 3 (112 vs 105), then
        # team 1 itself in week 3, since team 1's opponent that week was 4 (80 vs 125)
        self.assertEqual(grid[(4, 1)], [1, 2, 0])


if __name__ == '__main__':
    unittest.main()
