"""Playoff odds by week, simulated from the scores so far.

See docs/proposals/playoff-odds.md. For each week N, games through week N are
final and every later regular-season game is simulated, so the same code gives
odds for any week of any season, past or current.
"""
import random
import statistics
import zlib
from collections import namedtuple

from .season import REGULAR, Record, records
from .seeding import seed_teams

SIMULATIONS = 2000
# Each team's average starts as this many league-average games, so a hot first
# week doesn't make a team a favorite. Weekly scores vary about three times as
# much as true team strength does (Gridiron 2019–2025), which puts this near 10;
# scripts/check_odds.py confirmed 10 is better calibrated than 3.
PRIOR_GAMES = 10
# Before any games every team is equal, so only the schedule matters; the
# numbers themselves don't affect the odds
WEEK_ZERO_MEAN = 100.0
WEEK_ZERO_SPREAD = 25.0

# Just what seeding's head-to-head tiebreaker reads from a game
_SimGame = namedtuple('_SimGame', 'home away winner')


def completed_weeks(season):
    """The last regular-season week whose games are all decided (0 if none)."""
    last = 0
    for week in range(1, season.settings.regular_season_weeks + 1):
        games = [g for g in season.games if g.tier == REGULAR and g.week == week and not g.is_bye]
        if not games or not all(g.decided for g in games):
            break
        last = week
    return last


def score_model(season, through_week):
    """Each team's expected score, and the spread of one team's weekly score.

    Returns:
        (means, spread): team id -> expected points, and a standard deviation
    """
    scores = {team_id: [] for team_id in season.teams}
    for game in season.regular_season_games(through_week):
        scores[game.home].append(game.home_points)
        scores[game.away].append(game.away_points)

    every_score = [s for team_scores in scores.values() for s in team_scores]
    if len(every_score) < 2:
        return {team_id: WEEK_ZERO_MEAN for team_id in season.teams}, WEEK_ZERO_SPREAD

    league_average = statistics.fmean(every_score)
    # League-wide, because one team's spread over a few games is too noisy
    spread = statistics.pstdev(every_score)
    means = {team_id: (PRIOR_GAMES * league_average + sum(s)) / (PRIOR_GAMES + len(s))
             for team_id, s in scores.items()}
    return means, spread


def odds_after_week(season, week, simulations=SIMULATIONS):
    """Playoff odds with games through `week` final and the rest simulated.

    Returns:
        {"week": 3, "teams": [{"team_id", "playoff_pct", "division_pct",
                               "seed_dist", "avg_wins"}, ...]}
        seed_dist[i] is the chance of finishing as seed i + 1.
    """
    settings = season.settings
    team_ids = list(season.teams)
    index = {team_id: i for i, team_id in enumerate(team_ids)}
    divisions = [season.teams[t].division_id for t in team_ids]
    division_count = len(set(divisions))
    head_to_head = settings.seeding_rule == 'H2H_RECORD'

    played = season.regular_season_games(week)
    remaining = [g for g in season.games
                 if g.tier == REGULAR and not g.is_bye
                 and week < g.week <= settings.regular_season_weeks]
    if not remaining:
        simulations = 1  # nothing left to chance

    base = records(season, week)
    means, spread = score_model(season, week)
    # A fixed seed per league, season and week, so odds don't change between page loads
    rng = random.Random(zlib.crc32(f'{season.league_id}-{season.year}-{week}'.encode()))
    gauss = rng.gauss

    made_playoffs = [0] * len(team_ids)
    won_division = [0] * len(team_ids)
    seed_counts = [[0] * len(team_ids) for _ in team_ids]
    total_wins = [0] * len(team_ids)

    for _ in range(simulations):
        wins = [base[t].wins for t in team_ids]
        losses = [base[t].losses for t in team_ids]
        ties = [base[t].ties for t in team_ids]
        points = [base[t].points_for for t in team_ids]
        sim_games = list(played) if head_to_head else ()

        for game in remaining:
            h, a = index[game.home], index[game.away]
            home_points = gauss(means[game.home], spread)
            away_points = gauss(means[game.away], spread)
            points[h] += home_points
            points[a] += away_points
            if home_points > away_points:
                wins[h] += 1
                losses[a] += 1
                winner = game.home
            else:
                wins[a] += 1
                losses[h] += 1
                winner = game.away
            if head_to_head:
                sim_games.append(_SimGame(game.home, game.away, winner))

        sim_records = [Record(t, divisions[i], wins[i], losses[i], ties[i], points[i])
                       for i, t in enumerate(team_ids)]
        order = seed_teams(sim_records, settings.seeding_rule, sim_games)
        for seed, team_id in enumerate(order):
            i = index[team_id]
            seed_counts[i][seed] += 1
            if seed < settings.playoff_team_count:
                made_playoffs[i] += 1
            if seed < division_count:
                won_division[i] += 1
        for i in range(len(team_ids)):
            total_wins[i] += wins[i]

    return {
        "week": week,
        "teams": [{
            "team_id": t,
            "playoff_pct": made_playoffs[i] / simulations,
            "division_pct": won_division[i] / simulations,
            "seed_dist": [c / simulations for c in seed_counts[i]],
            "avg_wins": total_wins[i] / simulations,
        } for i, t in enumerate(team_ids)],
    }


def playoff_odds(season, simulations=SIMULATIONS):
    """Odds after every completed week, from week 0 (before any games), plus highlights."""
    weeks = [odds_after_week(season, week, simulations)
             for week in range(completed_weeks(season) + 1)]
    return {"weeks": weeks, "highlights": highlights(season, weeks)}


def highlights(season, weeks):
    """The season's biggest moves in playoff odds. Collapse and comeback need
    the regular season to be over, since they depend on who made it."""
    if len(weeks) < 2:
        return []
    # Each team's playoff odds by week. Weeks run 0, 1, 2..., so a list index is its week.
    pct = {t: [] for t in season.teams}
    for week_odds in weeks:
        for team in week_odds["teams"]:
            pct[team["team_id"]].append(team["playoff_pct"])
    moves = [(pct[t][i] - pct[t][i - 1], t, weeks[i]["week"])
             for t in season.teams for i in range(1, len(weeks))]

    found = []
    gain, team_id, week = max(moves)
    if gain > 0:
        found.append({"type": "riser", "team_id": team_id, "week": week,
                      "from": pct[team_id][week - 1], "to": pct[team_id][week]})
    drop, team_id, week = min(moves)
    if drop < 0:
        found.append({"type": "faller", "team_id": team_id, "week": week,
                      "from": pct[team_id][week - 1], "to": pct[team_id][week]})

    if weeks[-1]["week"] == season.settings.regular_season_weeks:
        made = {t for t in season.teams if pct[t][-1] == 1.0}
        missed = [(max(pct[t]), t) for t in season.teams if t not in made]
        if missed:
            peak, team_id = max(missed)
            found.append({"type": "collapse", "team_id": team_id,
                          "week": pct[team_id].index(peak), "pct": peak})
        survivors = [(min(pct[t]), t) for t in made]
        if survivors:
            low, team_id = min(survivors)
            found.append({"type": "comeback", "team_id": team_id,
                          "week": pct[team_id].index(low), "pct": low})

    # The game whose week moved its two teams' odds the most
    swings = [(abs(pct[g.home][g.week] - pct[g.home][g.week - 1]) +
               abs(pct[g.away][g.week] - pct[g.away][g.week - 1]), g)
              for g in season.regular_season_games(weeks[-1]["week"])]
    if swings:
        swing, game = max(swings, key=lambda s: s[0])
        if swing > 0:
            found.append({"type": "biggest_game", "week": game.week, "home": game.home,
                          "away": game.away, "winner": game.winner,
                          "home_points": game.home_points, "away_points": game.away_points,
                          "swing": swing})
    return found
