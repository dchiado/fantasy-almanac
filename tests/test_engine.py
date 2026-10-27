"""Tests for the pure season engine. Run from the repo root:

    python3 -m unittest discover tests
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'utils_layer' / 'python'))

from engine.season import CONSOLATION, PLAYOFF, REGULAR, Record, parse_season, records  # noqa: E402
from engine.seeding import UnsupportedSeedingRule, seed_teams  # noqa: E402


def matchup(week, home, home_pts, away=None, away_pts=None, tier='NONE', winner=None):
    m = {'matchupPeriodId': week, 'playoffTierType': tier,
         'home': {'teamId': home, 'totalPoints': home_pts}}
    if away is not None:
        m['away'] = {'teamId': away, 'totalPoints': away_pts}
    if winner is None:
        winner = 'UNDECIDED' if away is None else (
            'HOME' if home_pts > away_pts else 'AWAY' if away_pts > home_pts else 'TIE')
    m['winner'] = winner
    return m


def views(schedule, divisions=None, rule='TOTAL_POINTS_SCORED', regular_weeks=2):
    """Four teams; teams 1 and 2 in division 0, teams 3 and 4 in division 1."""
    divisions = divisions or {1: 0, 2: 0, 3: 1, 4: 1}
    return {
        'mSettings': {'settings': {'scheduleSettings': {
            'matchupPeriodCount': regular_weeks,
            'playoffTeamCount': 2,
            'playoffSeedingRule': rule,
            'divisions': [{'id': 0, 'name': 'East'}, {'id': 1, 'name': 'West'}],
        }}},
        'mTeam': {
            'teams': [{'id': t, 'name': f'Team {t}', 'abbrev': f'T{t}', 'divisionId': d,
                       'primaryOwner': f'{{owner-{t}}}', 'playoffSeed': 0}
                      for t, d in divisions.items()],
            'members': [{'id': f'{{owner-{t}}}', 'firstName': 'pat ', 'lastName': f'owner{t}'}
                        for t in divisions],
        },
        'mMatchupScore': {'schedule': schedule},
    }


class ParseSeasonTest(unittest.TestCase):
    def test_games(self):
        season = parse_season(1, 2025, views([
            matchup(1, 1, 100, 2, 90),
            matchup(1, 3, 80, 4, 80),
            matchup(3, 1, 0, tier='WINNERS_BRACKET'),  # playoff bye
            matchup(3, 2, 90, 3, 95, tier='WINNERS_CONSOLATION_LADDER'),
        ]))
        win, tie, bye, consolation = season.games

        self.assertEqual((win.tier, win.decided, win.winner), (REGULAR, True, 1))
        self.assertEqual((tie.decided, tie.winner), (True, None))
        self.assertEqual((bye.tier, bye.is_bye, bye.decided, bye.winner), (PLAYOFF, True, False, None))
        self.assertEqual((consolation.tier, consolation.winner), (CONSOLATION, 3))

    def test_teams(self):
        raw = views([])
        raw['mTeam']['teams'][0] = {'id': 1, 'location': 'Little', 'nickname': 'Achievers',
                                    'divisionId': 0, 'owners': ['{owner-1}'],
                                    'playoffSeed': 3, 'rankCalculatedFinal': 1}
        team = parse_season(1, 2012, raw).teams[1]

        self.assertEqual(team.name, 'Little Achievers')
        self.assertEqual(team.owner_id, '{owner-1}')
        self.assertEqual(team.owner_name, 'Pat Owner1')
        self.assertEqual((team.playoff_seed, team.final_rank), (3, 1))
        self.assertIsNone(parse_season(1, 2012, raw).teams[2].playoff_seed)  # 0 means not seeded

    def test_records_use_regular_season_only(self):
        season = parse_season(1, 2025, views([
            matchup(1, 1, 100, 2, 90),
            matchup(1, 3, 80, 4, 80),
            matchup(2, 1, 70, 3, 75),
            matchup(2, 2, 60, 4, 50),
            matchup(3, 1, 200, 2, 10, tier='WINNERS_BRACKET'),
        ]))
        recs = records(season)

        self.assertEqual((recs[1].wins, recs[1].losses, recs[1].points_for), (1, 1, 170))
        self.assertEqual((recs[3].wins, recs[3].ties, recs[3].points_against), (1, 1, 150))
        self.assertEqual(recs[4].win_pct, 0.25)
        self.assertEqual(records(season, through_week=1)[1].points_for, 100)

    def test_records_follow_espn_winner(self):
        # Equal points, but the league's tiebreaker gave the game to the away team
        season = parse_season(1, 2025, views([matchup(1, 1, 90, 2, 90, winner='AWAY')]))
        recs = records(season)

        self.assertEqual((recs[1].losses, recs[2].wins), (1, 1))


class SeedTeamsTest(unittest.TestCase):
    def rec(self, team_id, division_id, wins, losses, points):
        return Record(team_id, division_id, wins=wins, losses=losses, points_for=points)

    def test_division_winners_first(self):
        recs = [self.rec(1, 0, 10, 3, 1500),  # wins division 0
                self.rec(2, 0, 9, 4, 1600),   # better than team 3, but not a division winner
                self.rec(3, 1, 7, 6, 1400),   # wins division 1
                self.rec(4, 1, 5, 8, 1700)]
        self.assertEqual(seed_teams(recs, 'TOTAL_POINTS_SCORED'), [1, 3, 2, 4])

    def test_ties_go_to_points(self):
        recs = [self.rec(1, 0, 8, 5, 1500),
                self.rec(2, 0, 8, 5, 1600),   # wins division 0 on points
                self.rec(3, 1, 8, 5, 1400),
                self.rec(4, 1, 6, 7, 1700)]
        self.assertEqual(seed_teams(recs, 'TOTAL_POINTS_SCORED'), [2, 3, 1, 4])

    def test_head_to_head(self):
        # Teams 2 and 3 are 8-5; team 3 has fewer points but beat team 2 twice
        recs = [self.rec(1, 0, 10, 3, 1500),
                self.rec(2, 0, 8, 5, 1600),
                self.rec(3, 1, 8, 5, 1400),
                self.rec(4, 1, 6, 7, 1700)]
        games = parse_season(1, 2012, views([matchup(1, 2, 90, 3, 100),
                                             matchup(2, 3, 110, 2, 100)])).games
        self.assertEqual(seed_teams(recs, 'H2H_RECORD', games), [1, 3, 2, 4])
        self.assertEqual(seed_teams(recs, 'TOTAL_POINTS_SCORED', games), [1, 3, 2, 4])

    def test_head_to_head_split_goes_to_points(self):
        recs = [self.rec(1, 0, 8, 5, 1500),
                self.rec(2, 0, 8, 5, 1600),
                self.rec(3, 1, 10, 3, 1400),
                self.rec(4, 1, 6, 7, 1700)]
        games = parse_season(1, 2012, views([matchup(1, 1, 100, 2, 90),
                                             matchup(2, 2, 100, 1, 90)])).games
        # Division 0 tie: 1-1 head to head, so team 2 wins it on points
        self.assertEqual(seed_teams(recs, 'H2H_RECORD', games), [3, 2, 1, 4])

    def test_head_to_head_three_way(self):
        # 2, 3 and 4 tied at 8-5, all in one division behind team 1. Team 2 has the
        # best record against the other two, but head-to-head isn't used across
        # three teams: 4 goes first on points, then 2 and 3 split 1-1, so points again.
        recs = [self.rec(1, 0, 12, 1, 1500),
                self.rec(2, 0, 8, 5, 1400),
                self.rec(3, 0, 8, 5, 1600),
                self.rec(4, 0, 8, 5, 1700)]
        games = parse_season(1, 2012, views([matchup(1, 2, 100, 3, 90),
                                             matchup(2, 3, 100, 2, 90),
                                             matchup(3, 2, 100, 4, 90),
                                             matchup(4, 3, 100, 4, 90)])).games
        self.assertEqual(seed_teams(recs, 'H2H_RECORD', games), [1, 4, 3, 2])

    def test_head_to_head_decides_last_two_of_three(self):
        # 4 goes first on points; 2 beat 3, so 2 is next despite fewer points
        recs = [self.rec(1, 0, 12, 1, 1500),
                self.rec(2, 0, 8, 5, 1400),
                self.rec(3, 0, 8, 5, 1600),
                self.rec(4, 0, 8, 5, 1700)]
        games = parse_season(1, 2012, views([matchup(1, 2, 100, 3, 90)])).games
        self.assertEqual(seed_teams(recs, 'H2H_RECORD', games), [1, 4, 2, 3])

    def test_unsupported_rule(self):
        with self.assertRaises(UnsupportedSeedingRule):
            seed_teams([self.rec(1, 0, 1, 0, 100)], 'INTRA_DIVISION_RECORD')


if __name__ == '__main__':
    unittest.main()
