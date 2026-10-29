"""Tests for engine.recap and engine.rosters. Run from the repo root:

    python3 -m unittest discover tests
"""
import unittest

from test_engine import matchup, views  # also puts utils_layer/python on the path
from test_odds_and_luck import round_robin

from engine.recap import (  # noqa: E402
    all_time_scores, best_pickup, game_of_the_week, had_who, head_to_head, luck_items,
    odds_movers, recap_inputs, top_starter, week_games, weekly_recap,
)
from engine.report import season_report  # noqa: E402
from engine.rosters import merge_lineups, parse_adds, parse_lineups  # noqa: E402
from engine.season import last_played_week, parse_season  # noqa: E402
from engine.simulation import odds_after_week  # noqa: E402


def season(schedule, year=2025, regular_weeks=2):
    return parse_season(1, year, views(schedule, regular_weeks=regular_weeks))


# Week 1: 1 beats 2 (130-125), 3 beats 4 (90-80). Team 2 scored 2nd and lost;
# team 3 scored 3rd and won.
UPSET_WEEK = [matchup(1, 1, 130, 2, 125), matchup(1, 3, 90, 4, 80)]


def player(player_id, points, starter=True, name=None):
    return {"player_id": player_id, "name": name or f"Player {player_id}", "position": "RB",
            "starter": starter, "points": points}


class LastPlayedWeekTest(unittest.TestCase):
    def test_counts_winners_bracket_not_byes_or_consolation(self):
        s = season([
            *UPSET_WEEK,
            matchup(2, 1, 100, 2, 90), matchup(2, 3, 100, 4, 90),
            matchup(3, 1, 0, tier='WINNERS_BRACKET'),  # a bye, never decided
            matchup(3, 2, 110, 3, 100, tier='WINNERS_BRACKET'),
            matchup(3, 4, 0, 5, 0, tier='LOSERS_CONSOLATION_LADDER', winner='UNDECIDED'),
            matchup(4, 1, 0, 2, 0, tier='WINNERS_BRACKET', winner='UNDECIDED'),
        ])
        self.assertEqual(last_played_week(s), 3)
        self.assertEqual(len(week_games(s, 3)), 1)


class LuckTest(unittest.TestCase):
    def test_upset(self):
        s = season(UPSET_WEEK)
        games = week_games(s, 1)
        scores = sorted(((p, t) for t, p in ((1, 130), (2, 125), (3, 90), (4, 80))), reverse=True)
        items = luck_items(games, scores)
        self.assertEqual((items["luckiest_win"]["team_id"], items["luckiest_win"]["place"]), (3, 3))
        self.assertEqual((items["unluckiest_loss"]["team_id"], items["unluckiest_loss"]["place"]), (2, 2))

    def test_nobody_lucky_when_top_half_wins(self):
        s = season([matchup(1, 1, 130, 2, 80), matchup(1, 3, 120, 4, 90)])
        scores = [(130, 1), (120, 3), (90, 4), (80, 2)]
        self.assertEqual(luck_items(week_games(s, 1), scores), {"luckiest_win": None, "unluckiest_loss": None})


class LineupItemsTest(unittest.TestCase):
    def test_had_who_ignores_bench_and_winners(self):
        games = week_games(season(UPSET_WEEK), 1)
        lineups = {
            1: {10: player(10, 60)},  # winner
            2: {20: player(20, 35), 21: player(21, 50, starter=False)},
            4: {40: player(40, 30)},
        }
        found = had_who(games, lineups)
        self.assertEqual((found["team_id"], found["player"]["player_id"]), (2, 20))

    def test_best_pickup_that_won_it(self):
        games = week_games(season(UPSET_WEEK), 1)  # team 3 won by 10
        lineups = {
            3: {30: player(30, 12)},
            2: {20: player(20, 25, starter=False)},
        }
        adds = [{"player_id": 30, "team_id": 3, "type": "waiver", "bid_amount": 4},
                {"player_id": 20, "team_id": 2, "type": "free_agent", "bid_amount": 0}]
        pickup = best_pickup(games, lineups, adds)
        self.assertEqual((pickup["player_id"], pickup["won_it"], pickup["margin"]), (30, True, 10))

    def test_best_pickup_otherwise_most_points_even_on_bench(self):
        games = week_games(season(UPSET_WEEK), 1)
        lineups = {3: {30: player(30, 8)}, 2: {20: player(20, 25, starter=False)}}
        adds = [{"player_id": 30, "team_id": 3, "type": "waiver", "bid_amount": 0},
                {"player_id": 20, "team_id": 2, "type": "free_agent", "bid_amount": 0},
                {"player_id": 99, "team_id": 1, "type": "free_agent", "bid_amount": 0}]  # dropped again
        pickup = best_pickup(games, lineups, adds)
        self.assertEqual((pickup["player_id"], pickup["won_it"]), (20, False))
        self.assertIsNone(best_pickup(games, lineups, adds[2:]))


class AllTimeTest(unittest.TestCase):
    def test_noteworthy_scores_only(self):
        # 40 earlier scores between 90 and 114. This week 1 scores 130 (highest
        # ever) and 4 scores 80 (lowest ever); 105 and 100 are ordinary.
        earlier = season([matchup(w, 1, 90 + w, 2, 95 + w) for w in range(20)], year=2024, regular_weeks=20)
        s = season([matchup(1, 1, 130, 2, 105), matchup(1, 3, 100, 4, 80)])
        scores = [(130, 1), (105, 2), (100, 3), (80, 4)]
        found = all_time_scores(s, 1, scores, [earlier])
        self.assertEqual(found["since"], 2024)
        self.assertEqual(found["count"], 44)
        self.assertEqual([(x["team_id"], x["kind"], x["rank"]) for x in found["scores"]],
                         [(1, "high", 1), (4, "low", 1)])

    def test_no_history(self):
        self.assertIsNone(all_time_scores(season(UPSET_WEEK), 1, [(130, 1)], []))


class HeadToHeadTest(unittest.TestCase):
    def test_by_owner_across_seasons(self):
        a = season([matchup(1, 1, 100, 2, 90), matchup(2, 2, 100, 1, 90)], year=2024)
        b = season([matchup(1, 2, 100, 1, 90), matchup(1, 3, 100, 4, 100)], year=2025)
        self.assertEqual(head_to_head([a, b], '{owner-2}', '{owner-1}'), (2, 1, 0))
        self.assertEqual(head_to_head([b], '{owner-3}', '{owner-4}'), (0, 0, 1))


class StakesTest(unittest.TestCase):
    def test_odds_with_a_win_and_a_loss(self):
        # Three regular weeks, week 3 still to play: inside the stretch run
        teams = {t["team_id"]: t for t in odds_after_week(round_robin(week3_played=False), 2)["teams"]}
        for t in teams.values():
            self.assertGreaterEqual(t["if_win_pct"] or 0, t["if_loss_pct"] or 0)
        self.assertNotIn("if_win_pct", odds_after_week(round_robin(), 3)["teams"][0])

    def test_game_of_the_week(self):
        s = round_robin(week3_played=False)
        report = season_report(s, simulations=200)
        game = game_of_the_week(s, 2, report, [])
        self.assertEqual(game["week"], 3)
        self.assertEqual(game["head_to_head"], {"home_wins": 0, "away_wins": 0, "ties": 0})
        # After the last regular-season week there is no next game
        self.assertIsNone(game_of_the_week(s, 3, report, []))


class OddsMoversTest(unittest.TestCase):
    def test_final_week_clinches_are_exact(self):
        s = round_robin()
        report = season_report(s, simulations=200)
        movers = odds_movers(s, 3, report)
        self.assertEqual(sorted(movers["clinched"] + movers["eliminated"]), [1, 2, 3, 4])
        self.assertNotIn(1, movers["eliminated"])


class RecapTest(unittest.TestCase):
    def test_whole_recap(self):
        s = round_robin()
        report = season_report(s, simulations=200)
        recap = weekly_recap(s, 3, {}, [], report, [], {})
        self.assertEqual((recap["high_score"], recap["low_score"]),
                         ({"team_id": 1, "points": 125}, {"team_id": 4, "points": 80}))
        self.assertEqual(recap["biggest_win"]["margin"], 45)
        self.assertEqual(recap["closest_win"]["team_id"], 3)
        self.assertIsNone(recap["all_time"])
        self.assertIsNone(recap["game_of_the_week"])  # no week after the regular season
        self.assertIsNone(recap["games"][0]["home_top"])  # no lineups, so no player points

    def test_top_starter(self):
        lineups = {1: {1: player(1, 30.0, starter=False), 2: player(2, 20.0), 3: player(3, 25.0)},
                   2: {4: player(4, 0.0)}}
        self.assertEqual(top_starter(lineups, 1), {"name": "Player 3", "position": "RB", "points": 25.0})
        self.assertIsNone(top_starter(lineups, 2))  # no player points

    def test_inputs_change_with_the_week_not_later_weeks(self):
        before = recap_inputs(season([*UPSET_WEEK, matchup(2, 1, 100, 2, 90)]), 1)
        later = recap_inputs(season([*UPSET_WEEK, matchup(2, 1, 50, 2, 90)]), 1)
        corrected = recap_inputs(season([matchup(1, 1, 131, 2, 125), UPSET_WEEK[1], matchup(2, 1, 100, 2, 90)]), 1)
        self.assertEqual(before, later)
        self.assertNotEqual(before, corrected)


class RostersTest(unittest.TestCase):
    def test_parse(self):
        def entry(player_id, slot, points):
            return {"playerId": player_id, "lineupSlotId": slot, "playerPoolEntry": {"player": {
                "fullName": f"P{player_id}", "defaultPositionId": 2, "eligibleSlots": [2, 3, 20], "stats": [
                    {"scoringPeriodId": 5, "statSourceId": 1, "appliedTotal": 99},
                    {"scoringPeriodId": 5, "statSourceId": 0, "appliedTotal": points}]}}}
        week5 = parse_lineups({"teams": [{"id": 1, "roster": {"entries": [entry(7, 2, 12.5), entry(8, 20, 3)]}}]}, 5)
        self.assertEqual(week5[1][7], {"player_id": 7, "name": "P7", "position": "RB", "slot": 2,
                                       "eligible_slots": [2, 3, 20], "starter": True, "points": 12.5})
        self.assertFalse(week5[1][8]["starter"])

        both = merge_lineups([week5, {1: {8: {**week5[1][8], "starter": True, "points": 4}}}])
        self.assertEqual((both[1][8]["starter"], both[1][8]["points"]), (True, 7))

    def test_adds(self):
        transactions = [
            {"type": "WAIVER", "status": "EXECUTED", "bidAmount": 12, "items": [
                {"type": "ADD", "playerId": 1, "toTeamId": 3}, {"type": "DROP", "playerId": 2, "toTeamId": 0}]},
            {"type": "WAIVER", "status": "FAILED_PLAYERALREADYDROPPED", "items": [
                {"type": "ADD", "playerId": 5, "toTeamId": 4}]},
            {"type": "FREEAGENT", "status": "EXECUTED", "items": [{"type": "ADD", "playerId": 6, "toTeamId": 4}]},
            {"type": "ROSTER", "status": "EXECUTED", "items": [{"type": "LINEUP", "playerId": 7, "toTeamId": 0}]},
        ]
        self.assertEqual(parse_adds(transactions), [
            {"player_id": 1, "team_id": 3, "type": "waiver", "bid_amount": 12},
            {"player_id": 6, "team_id": 4, "type": "free_agent", "bid_amount": 0},
        ])


if __name__ == '__main__':
    unittest.main()
