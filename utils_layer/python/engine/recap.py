"""One week's stories, worked out from the final scores: the high and low
score, the biggest and closest wins, luck, the best player on a losing team,
the best pickup, playoff odds movers and next week's biggest game. See
docs/proposals/weekly-recap.md. Plain dicts and lists, ready to serialize."""
import hashlib
from dataclasses import replace

from .report import REPORT_VERSION
from .scenarios import SCENARIO_WEEKS, playoff_scenarios
from .season import CONSOLATION, PLAYOFF, REGULAR

# Bump when the output changes, so stored recaps are recomputed
RECAP_VERSION = 2

# A score gets its all-time rank in the recap only if it's in the top or bottom
# share of every score in league history. At 10% the week's high score made it
# about 72% of weeks (1 - 0.9^12 with 12 teams); at 5% it's about 46%.
NOTEWORTHY_SHARE = 0.05


def week_games(season, week):
    """The week's decided games, regular season or winners bracket."""
    return [g for g in season.games
            if g.week == week and g.tier in (REGULAR, PLAYOFF) and g.decided]


def weekly_recap(season, week, lineups, adds, report, history):
    """The recap for one week whose games are all decided.

    Args:
        season: the Season the week is in
        week: the matchup period
        lineups: team id -> {player id: player}, from rosters.merge_lineups
        adds: the week's pickups, from rosters.parse_adds
        report: the season's report (report.season_report), for playoff odds
        history: earlier seasons, oldest first, for all-time ranks and head-to-head
    """
    games = week_games(season, week)
    scores = sorted(((points, team_id) for g in games
                     for team_id, points in ((g.home, g.home_points), (g.away, g.away_points))),
                    reverse=True)
    regular = week <= season.settings.regular_season_weeks

    return {
        "version": RECAP_VERSION,
        "year": season.year,
        "week": week,
        "playoffs": not regular,
        "regular_season_weeks": season.settings.regular_season_weeks,
        # False when first place wins the title: the odds are then title odds
        "has_playoffs": season.settings.has_playoffs,
        "teams": [{"team_id": t.id, "name": t.name, "abbrev": t.abbrev, "logo": t.logo,
                   "owner_name": t.owner_name} for t in season.teams.values()],
        "games": [{"home": g.home, "away": g.away, "home_points": g.home_points,
                   "away_points": g.away_points, "winner": g.winner,
                   "playoff": g.tier == PLAYOFF} for g in games],
        "high_score": {"team_id": scores[0][1], "points": scores[0][0]},
        "low_score": {"team_id": scores[-1][1], "points": scores[-1][0]},
        "all_time": all_time_scores(season, week, scores, history),
        "biggest_win": _margin_game(games, max),
        "closest_win": _margin_game(games, min),
        **luck_items(games, scores),
        "had_who": had_who(games, lineups),
        "best_pickup": best_pickup(games, lineups, adds),
        "odds_movers": odds_movers(season, week, report) if regular else None,
        "game_of_the_week": game_of_the_week(season, week, report, history) if regular else None,
    }


def _result(game):
    """(winner, loser, winner points, loser points) for a game that wasn't a tie."""
    if game.winner == game.home:
        return game.home, game.away, game.home_points, game.away_points
    return game.away, game.home, game.away_points, game.home_points


def _margin_game(games, pick):
    """The win with the largest (max) or smallest (min) margin."""
    wins = [_result(g) for g in games if g.winner is not None]
    if not wins:
        return None
    winner, loser, points, opponent_points = pick(wins, key=lambda w: w[2] - w[3])
    return {"team_id": winner, "opponent_id": loser, "points": points,
            "opponent_points": opponent_points, "margin": round(points - opponent_points, 2)}


def all_time_scores(season, week, scores, history):
    """This week's scores in the top or bottom NOTEWORTHY_SHARE of league
    history, counting only games up to this week so a stored recap never goes
    stale. None when there's no earlier season to compare with.

    Returns:
        {"since": 2019, "count": 3800,
         "scores": [{"team_id", "points", "rank", "kind": "high" | "low"}, ...]}
        rank is 1 for the highest (or lowest) score ever.
    """
    if not history:
        return None
    every = []
    for s in [*history, season]:
        for g in s.games:
            if g.tier != CONSOLATION and g.decided and (s is not season or g.week <= week):
                every += [g.home_points, g.away_points]

    cutoff = len(every) * NOTEWORTHY_SHARE
    noteworthy = []
    for points, team_id in scores:
        higher = sum(1 for p in every if p > points)
        lower = sum(1 for p in every if p < points)
        if higher < cutoff:
            noteworthy.append({"team_id": team_id, "points": points, "rank": higher + 1, "kind": "high"})
        elif lower < cutoff:
            noteworthy.append({"team_id": team_id, "points": points, "rank": lower + 1, "kind": "low"})
    return {"since": history[0].year, "count": len(every), "scores": noteworthy}


def luck_items(games, scores):
    """The lowest-scoring winner, if it scored in the bottom half of the week,
    and the highest-scoring loser, if it scored in the top half. Half the teams
    win, so the two always come together: if the top half all won, neither does.

    place is the team's place among the week's scores, 1 for the highest."""
    places = {team_id: i + 1 for i, (_, team_id) in enumerate(scores)}
    results = [_result(g) for g in games if g.winner is not None]
    if not results:
        return {"luckiest_win": None, "unluckiest_loss": None}
    half = len(scores) / 2

    winner, loser, points, opponent_points = max(results, key=lambda r: places[r[0]])
    lucky = places[winner] > half and {
        "team_id": winner, "opponent_id": loser, "points": points,
        "opponent_points": opponent_points, "place": places[winner], "of": len(scores)}
    winner, loser, opponent_points, points = min(results, key=lambda r: places[r[1]])
    unlucky = places[loser] <= half and {
        "team_id": loser, "opponent_id": winner, "points": points,
        "opponent_points": opponent_points, "place": places[loser], "of": len(scores)}
    return {"luckiest_win": lucky or None, "unluckiest_loss": unlucky or None}


def had_who(games, lineups):
    """The highest-scoring starter on a losing team."""
    best = None
    for game in games:
        if game.winner is None:
            continue
        winner, loser, winner_points, loser_points = _result(game)
        for player in lineups.get(loser, {}).values():
            if player["starter"] and (best is None or player["points"] > best["player"]["points"]):
                best = {"team_id": loser, "opponent_id": winner, "points": loser_points,
                        "opponent_points": winner_points, "player": player}
    return best


def best_pickup(games, lineups, adds):
    """The week's best free-agent or waiver add still on the team that added it.

    A pickup that started and outscored the margin of a win "won it" for its
    team; the highest-scoring of those comes first. Otherwise it's the add that
    scored the most, started or not."""
    margins = {}
    for game in games:
        if game.winner is not None:
            winner, _, points, opponent_points = _result(game)
            margins[winner] = points - opponent_points

    pickups = []
    for add in adds:
        player = lineups.get(add["team_id"], {}).get(add["player_id"])
        if player is None:
            continue  # dropped again before the week was over
        margin = margins.get(add["team_id"])
        won_it = player["starter"] and margin is not None and player["points"] > margin
        pickups.append({**add, "player": player, "won_it": won_it,
                        "margin": round(margin, 2) if margin is not None else None})
    if not pickups:
        return None
    return max(pickups, key=lambda p: (p["won_it"], p["player"]["points"]))


def _statuses(season, week, odds_week):
    """team id -> "clinched" | "eliminated" | other after a week, or None when
    unknown. Scenarios cover the last SCENARIO_WEEKS weeks; after the last
    regular-season week the odds are exact."""
    if week == season.settings.regular_season_weeks:
        return {t["team_id"]: "clinched" if t["playoff_pct"] == 1 else "eliminated"
                for t in odds_week["teams"]}
    scenarios = playoff_scenarios(season, week)
    return {t["team_id"]: t["status"] for t in scenarios["teams"]} if scenarios else None


def odds_movers(season, week, report):
    """The biggest rise and fall in playoff odds this week, and who clinched or
    was eliminated. Clinches only come from the scenarios or the final
    standings, never from a simulated 100%.

    Returns:
        {"rise": {"team_id", "before", "after"}, "fall": {...},
         "clinched": [team id, ...], "eliminated": [...]}
    """
    weeks = (report.get("playoff_odds") or {}).get("weeks", [])
    if len(weeks) <= week:
        return None
    before = {t["team_id"]: t["playoff_pct"] for t in weeks[week - 1]["teams"]}
    after = {t["team_id"]: t["playoff_pct"] for t in weeks[week]["teams"]}
    changes = sorted(after, key=lambda t: after[t] - before[t])

    def mover(team_id):
        return {"team_id": team_id, "before": before[team_id], "after": after[team_id]}

    now = _statuses(season, week, weeks[week]) or {}
    # Before the scenario weeks start, every clinch counts as new
    previous = (_statuses(season, week - 1, weeks[week - 1]) if week > 1 else None) or {}
    return {
        "rise": mover(changes[-1]) if after[changes[-1]] > before[changes[-1]] else None,
        "fall": mover(changes[0]) if after[changes[0]] < before[changes[0]] else None,
        "clinched": [t for t, s in now.items() if s == "clinched" and previous.get(t) != "clinched"],
        "eliminated": [t for t, s in now.items() if s == "eliminated" and previous.get(t) != "eliminated"],
    }


def head_to_head(seasons, owner_a, owner_b):
    """Two owners' record against each other in regular-season and winners
    bracket games: (a wins, b wins, ties). Games not yet decided don't count."""
    a_wins = b_wins = ties = 0
    for season in seasons:
        owners = {t.id: t.owner_id for t in season.teams.values()}
        for g in season.games:
            if g.tier == CONSOLATION or not g.decided:
                continue
            if {owners.get(g.home), owners.get(g.away)} != {owner_a, owner_b}:
                continue
            if g.winner is None:
                ties += 1
            elif owners[g.winner] == owner_a:
                a_wins += 1
            else:
                b_wins += 1
    return a_wins, b_wins, ties


def game_of_the_week(season, week, report, history):
    """Next week's game whose result moves the two teams' playoff odds the most,
    once the stretch run starts. The simulation gives each team's odds with a
    win and with a loss (engine/simulation.py).

    Returns:
        {"week": 12, "home": {"team_id", "pct", "if_win", "if_loss"}, "away": {...},
         "head_to_head": {"home_wins", "away_wins", "ties"}}
    """
    weeks = (report.get("playoff_odds") or {}).get("weeks", [])
    if not 1 <= season.settings.regular_season_weeks - week <= SCENARIO_WEEKS or len(weeks) <= week:
        return None
    odds = {t["team_id"]: t for t in weeks[week]["teams"]}

    def side(team_id):
        t = odds.get(team_id, {})
        return {"team_id": team_id, "pct": t.get("playoff_pct"),
                "if_win": t.get("if_win_pct"), "if_loss": t.get("if_loss_pct")}

    def swing(game):
        return sum((s["if_win"] or 0) - (s["if_loss"] or 0) for s in (side(game.home), side(game.away))
                   if s["if_win"] is not None and s["if_loss"] is not None)

    upcoming = [g for g in season.games if g.week == week + 1 and g.tier == REGULAR and not g.is_bye]
    if not upcoming:
        return None
    game = max(upcoming, key=swing)
    if swing(game) == 0:
        return None  # nothing riding on any game

    record = None
    owners = season.teams[game.home].owner_id, season.teams[game.away].owner_id
    if None not in owners:
        so_far = replace(season, games=tuple(g for g in season.games if g.week <= week))
        home_wins, away_wins, ties = head_to_head([*history, so_far], *owners)
        record = {"home_wins": home_wins, "away_wins": away_wins, "ties": ties}
    return {"week": week + 1, "home": side(game.home), "away": side(game.away), "head_to_head": record}


def recap_inputs(season, week):
    """A short hash of everything weekly_recap reads from the season: games
    through this week, next week's matchups, the teams and settings. A stat
    correction changes a team's score, so it changes the hash too. Rosters and
    pickups aren't in it; their points add up to the scores."""
    games = [g if g.week <= week else replace(g, home_points=0.0, away_points=0.0, decided=False, winner=None)
             for g in season.games if g.week <= week + 1]
    inputs = repr((RECAP_VERSION, REPORT_VERSION, week, season.settings, season.teams, games))
    return hashlib.sha256(inputs.encode()).hexdigest()[:16]
