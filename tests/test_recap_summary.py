"""Tests for engine.recap_summary. Run from the repo root:

    python3 -m unittest discover tests
"""
import unittest

from test_odds_and_luck import round_robin  # also puts utils_layer/python on the path

from engine.recap import weekly_recap  # noqa: E402
from engine.recap_summary import owner_names, recap_facts, summary_inputs  # noqa: E402
from engine.report import season_report  # noqa: E402


OWNERS = {1: "Ann Lee", 2: "Bo Diaz", 3: "Cy Fox", 4: "Di Ng"}


def recap(**items):
    """A two-game regular-season week: team 1 beats 2 (130-125), 3 beats 4 (90-80)."""
    base = {
        "year": 2025, "week": 5, "playoffs": False, "regular_season_weeks": 14, "has_playoffs": True,
        "teams": [{"team_id": t, "name": f"Team {t}", "owner_name": OWNERS[t]} for t in (1, 2, 3, 4)],
        "games": [
            {"home": 1, "away": 2, "home_points": 130.0, "away_points": 125.5, "winner": 1, "playoff": False},
            {"home": 4, "away": 3, "home_points": 80.0, "away_points": 90.25, "winner": 3, "playoff": False},
        ],
        "high_score": {"team_id": 1, "points": 130.0},
        "low_score": {"team_id": 4, "points": 80.0},
        "all_time": None, "biggest_win": None, "closest_win": None,
        "luckiest_win": None, "unluckiest_loss": None, "had_who": None, "best_pickup": None,
        "bench_blunders": [], "most_left": None, "odds_movers": None, "game_of_the_week": None,
    }
    return {**base, **items}


def player(name, points, starter=True):
    return {"player_id": 1, "name": name, "position": "RB", "starter": starter, "points": points}


class RecapFactsTest(unittest.TestCase):
    def test_games_and_scores(self):
        facts = recap_facts(recap())
        self.assertEqual(facts[0], "This is week 5 of the 2025 regular season, which has 14 weeks.")
        self.assertIn("Game: Ann beat Bo, 130 to 125.5.", facts)
        self.assertIn("Game: Cy beat Di, 90.25 to 80.", facts)
        self.assertIn("High score: Ann, 130.", facts)

    def test_top_scorers(self):
        games = [{"home": 1, "away": 2, "home_points": 130.0, "away_points": 125.5, "winner": 1,
                  "playoff": False, "home_top": player("A", 31.2), "away_top": None}]
        facts = recap_facts(recap(games=games))
        self.assertIn("Game: Ann beat Bo, 130 to 125.5. "
                      "Top scorers: A (RB, 31.2) for Ann.", facts)

    def test_championship(self):
        facts = recap_facts(recap(playoffs=True), championship=True)
        self.assertEqual(facts[0], "This is the championship week of the 2025 season.")

    def test_team_without_an_owner(self):
        teams = [{"team_id": t, "name": f"Team {t}", "owner_name": None} for t in (1, 2, 3, 4)]
        self.assertIn("High score: Team 1, 130.", recap_facts(recap(teams=teams)))

    def test_all_time_ranks_exact_only_near_the_top(self):
        all_time = {"since": 2005, "count": 3800, "scores": [
            {"team_id": 1, "points": 130.0, "rank": 4, "kind": "high"},
            {"team_id": 4, "points": 80.0, "rank": 90, "kind": "low"},
        ]}
        facts = recap_facts(recap(all_time=all_time))
        self.assertIn("Ann's 130 is the 4th-highest score of 3800 scores in league history "
                      "since 2005.", facts)
        self.assertIn("Di's 80 is among the lowest scores of 3800 scores in league history "
                      "since 2005.", facts)

    def test_luck(self):
        facts = recap_facts(recap(
            luckiest_win={"team_id": 3, "opponent_id": 4, "points": 90.25, "opponent_points": 80.0,
                          "place": 3, "of": 4},
            unluckiest_loss={"team_id": 2, "opponent_id": 1, "points": 125.5, "opponent_points": 130.0,
                             "place": 2, "of": 4},
        ))
        self.assertIn("Luckiest win: Cy had the 2nd-lowest score of the week and still beat "
                      "Di, 90.25 to 80.", facts)
        self.assertIn("Unluckiest loss: Bo had the 2nd-highest score of the week and still lost "
                      "to Ann, 125.5 to 130.", facts)

    def test_bench_blunder_leaves_out_most_left_for_the_same_team(self):
        blunder = {"team_id": 2, "opponent_id": 1, "points": 125.5, "opponent_points": 130.0,
                   "best_points": 140.5, "left": 15.0,
                   "should_have_started": [player("A", 20.0)], "should_have_sat": [player("B", 5.0)]}
        most = {"team_id": 2, "left": 15.0, "should_have_started": [player("A", 20.0)],
                "should_have_sat": [player("B", 5.0)]}
        facts = recap_facts(recap(bench_blunders=[blunder], most_left=most))
        self.assertIn("Bench blunder: Bo lost to Ann, 125.5 to 130, but their best "
                      "lineup would have scored 140.5 and won. They benched A (20) for B (5).", facts)
        self.assertFalse(any(f.startswith("Most points left") for f in facts))

    def test_pickup_that_won_it(self):
        pickup = {"team_id": 3, "type": "waiver", "bid_amount": 12, "player": player("C", 14.5),
                  "won_it": True, "margin": 10.25}
        facts = recap_facts(recap(best_pickup=pickup))
        self.assertIn("Best pickup: C (RB), a $12 waiver claim by Cy, scored 14.5, more than "
                      "their winning margin of 10.25.", facts)

    def test_title_odds_without_playoffs(self):
        movers = {"rise": {"team_id": 1, "before": 0.4, "after": 0.996}, "fall": None,
                  "clinched": [1], "eliminated": [4]}
        facts = recap_facts(recap(has_playoffs=False, odds_movers=movers))
        self.assertIn("Biggest rise in title odds: Ann, 40% to >99%.", facts)
        self.assertIn("Ann clinched the title.", facts)
        self.assertIn("Di can no longer win the title.", facts)

    def test_whole_recap_from_the_engine(self):
        s = round_robin()
        facts = recap_facts(weekly_recap(s, 3, {}, [], season_report(s, simulations=200), [], {}))
        self.assertTrue(any(f.startswith("Biggest win:") for f in facts))


class OwnerNamesTest(unittest.TestCase):
    def test_first_names_with_initials_only_when_shared(self):
        teams = [{"team_id": 1, "name": "A", "owner_name": "Connor Amice"},
                 {"team_id": 2, "name": "B", "owner_name": "Connor Jackson"},
                 {"team_id": 3, "name": "C", "owner_name": "Nam Pham"},
                 {"team_id": 4, "name": "Team Four  ", "owner_name": None}]
        self.assertEqual(owner_names(teams), {1: "Connor A.", 2: "Connor J.", 3: "Nam", 4: "Team Four"})


class SummaryInputsTest(unittest.TestCase):
    def test_changes_only_with_the_facts(self):
        facts = recap_facts(recap())
        self.assertEqual(summary_inputs(facts), summary_inputs(recap_facts(recap())))

        corrected = recap(high_score={"team_id": 1, "points": 131.0})
        self.assertNotEqual(summary_inputs(facts), summary_inputs(recap_facts(corrected)))


if __name__ == '__main__':
    unittest.main()
