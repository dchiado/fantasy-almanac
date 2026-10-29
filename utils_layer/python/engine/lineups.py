"""Lineup efficiency: each team's lineup against the best one it could have
started, for the weekly recap's bench blunders and the season's totals. See
"Lineup efficiency" in docs/season-engine.md. Plain dicts and lists, ready to
serialize."""
import hashlib

from .season import REGULAR, last_played_week

# Bump when the output changes, so stored season totals are recomputed
LINEUPS_VERSION = 1

# lineupSlotId for injured reserve. IR players never count toward the best lineup.
IR_SLOT = 21


def best_lineup(players, slots):
    """The highest-scoring lineup a team could have started.

    Every slot that some player can fill gets filled, whatever he scored, so a
    D/ST at -2 still starts when it's the only one. Players are taken by
    points, highest first, and each is kept if everyone kept so far can still
    get a slot. That greedy choice is optimal (the lineups form a transversal
    matroid), even with overlapping flex slots like RB/WR, FLEX and OP. On
    equal points the actual starter is taken, so a tie is never a swap.

    Args:
        players: [{"player_id", "points", "starter", "eligible_slots", ...}]
        slots: lineupSlotId -> count (Settings.lineup_slots)

    Returns:
        the chosen players
    """
    open_slots = [slot for slot, count in slots.items() for _ in range(count)]
    holders = {}  # index into open_slots -> index into players

    def place(p, tried):
        """Give player p a slot, moving players already placed if they can go
        elsewhere. Changes nothing if it fails."""
        for i, slot in enumerate(open_slots):
            if slot not in players[p]["eligible_slots"] or i in tried:
                continue
            tried.add(i)
            if i not in holders or place(holders[i], tried):
                holders[i] = p
                return True
        return False

    for p in sorted(range(len(players)), key=lambda p: (-players[p]["points"], not players[p]["starter"])):
        place(p, set())
    return [players[p] for p in holders.values()]


def _summary(player):
    return {"player_id": player["player_id"], "name": player["name"],
            "position": player["position"], "points": player["points"]}


def lineup_efficiency(periods, slots):
    """Each team's lineup against its best one, for one matchup period.

    Points come from the rosters alone, never the matchup score: when ESPN
    drops a player's stats (the cancelled 2022 Bills-Bengals game), the two
    still agree with each other.

    Args:
        periods: rosters.parse_lineups for each of the week's scoring periods.
            A matchup spanning two is the best lineup of each, added up.
        slots: lineupSlotId -> count (Settings.lineup_slots)

    Returns:
        team id -> {"points", "best_points", "left",
                    "should_have_started": [player, ...], "should_have_sat": [...]}
        Empty when the league's lineup slots aren't known.
    """
    if not slots:
        return {}

    teams = {}
    for lineups in periods:
        for team_id, players in lineups.items():
            candidates = [p for p in players.values() if p["slot"] != IR_SLOT]
            best = best_lineup(candidates, slots)
            best_ids = {p["player_id"] for p in best}

            team = teams.setdefault(team_id, {"points": 0.0, "best_points": 0.0,
                                              "should_have_started": [], "should_have_sat": []})
            team["points"] += sum(p["points"] for p in candidates if p["starter"])
            team["best_points"] += sum(p["points"] for p in best)
            team["should_have_started"] += [_summary(p) for p in best if not p["starter"]]
            team["should_have_sat"] += [_summary(p) for p in candidates
                                        if p["starter"] and p["player_id"] not in best_ids]

    for team in teams.values():
        team["points"] = round(team["points"], 2)
        team["best_points"] = round(team["best_points"], 2)
        team["left"] = round(team["best_points"] - team["points"], 2)
    return teams


def _sides(game):
    """(team, its score, opponent, opponent's score) for both sides of a game."""
    return ((game.home, game.home_points, game.away, game.away_points),
            (game.away, game.away_points, game.home, game.home_points))


def cost_the_game(game, team_id, points, opponent_points, efficiency):
    """Whether a team that didn't win would have, starting its best lineup
    against the opponent's actual score. The points left on the bench are
    added to the official score (see lineup_efficiency)."""
    lineup = efficiency.get(team_id)
    return (game.winner != team_id and lineup is not None
            and points + lineup["left"] > opponent_points)


def bench_blunders(games, efficiency):
    """Every team that didn't win but would have with its best lineup, most
    points left on the bench first. More than one team can, and both sides of
    different games can: each is against the opponent's actual score.

    Returns:
        [{"team_id", "opponent_id", "points", "opponent_points", "best_points",
          "left", "should_have_started", "should_have_sat"}, ...]
    """
    blunders = []
    for game in games:
        if not game.decided:
            continue
        for team_id, points, opponent_id, opponent_points in _sides(game):
            if cost_the_game(game, team_id, points, opponent_points, efficiency):
                lineup = efficiency[team_id]
                blunders.append({
                    "team_id": team_id, "opponent_id": opponent_id, "points": points,
                    "opponent_points": opponent_points,
                    "best_points": round(points + lineup["left"], 2), "left": lineup["left"],
                    "should_have_started": lineup["should_have_started"],
                    "should_have_sat": lineup["should_have_sat"],
                })
    return sorted(blunders, key=lambda b: -b["left"])


def most_left(games, efficiency):
    """The team in the week's games that left the most points on the bench,
    or None if every one started its best lineup."""
    team_ids = {t for g in games for t in (g.home, g.away) if t in efficiency}
    if not team_ids:
        return None
    team_id = max(team_ids, key=lambda t: efficiency[t]["left"])
    lineup = efficiency[team_id]
    if lineup["left"] <= 0:
        return None
    return {"team_id": team_id, "left": lineup["left"],
            "should_have_started": lineup["should_have_started"],
            "should_have_sat": lineup["should_have_sat"]}


def lineup_weeks(season):
    """The regular-season weeks whose games are all decided."""
    return range(1, min(last_played_week(season), season.settings.regular_season_weeks) + 1)


def season_lineups(season, weeks):
    """Each team's regular season: points left on the bench, games its best
    lineup would have won, and its head-to-head record with those as wins.
    The top-half bonus isn't in either record.

    Args:
        weeks: week -> lineup_efficiency, for each of lineup_weeks(season)

    Returns:
        {"version", "year", "weeks": number of weeks,
         "teams": [{"team_id", "left", "perfect_weeks", "worst_week": {"week", "left"},
                    "blunders", "record": {"wins", "losses", "ties"},
                    "best_record": {...}}, ...]}  most points left first
    """
    teams = {t: {"team_id": t, "left": 0.0, "perfect_weeks": 0, "worst_week": None, "blunders": 0,
                 "record": {"wins": 0, "losses": 0, "ties": 0},
                 "best_record": {"wins": 0, "losses": 0, "ties": 0}}
             for t in season.teams}

    for week, efficiency in weeks.items():
        for team_id, lineup in efficiency.items():
            team = teams.get(team_id)
            if team is None:
                continue
            team["left"] += lineup["left"]
            if lineup["left"] <= 0:
                team["perfect_weeks"] += 1
            if team["worst_week"] is None or lineup["left"] > team["worst_week"]["left"]:
                team["worst_week"] = {"week": week, "left": lineup["left"]}

        for game in season.games:
            if game.week != week or game.tier != REGULAR or not game.decided:
                continue
            for team_id, points, _, opponent_points in _sides(game):
                if game.winner == team_id:
                    result = "wins"
                elif game.winner is None:
                    result = "ties"
                else:
                    result = "losses"
                teams[team_id]["record"][result] += 1

                if cost_the_game(game, team_id, points, opponent_points, efficiency):
                    teams[team_id]["blunders"] += 1
                    result = "wins"
                teams[team_id]["best_record"][result] += 1

    for team in teams.values():
        team["left"] = round(team["left"], 2)
    return {
        "version": LINEUPS_VERSION,
        "year": season.year,
        "weeks": len(weeks),
        "teams": sorted(teams.values(), key=lambda t: -t["left"]),
    }


def lineups_inputs(season):
    """A short hash of everything season_lineups reads from the season: the
    decided regular-season games, the teams and settings. Rosters aren't in
    it, so a stat correction to a bench player shows the next time a game
    finishes, or once the season is final."""
    weeks = lineup_weeks(season)
    games = [g for g in season.games if g.tier == REGULAR and g.week in weeks]
    inputs = repr((LINEUPS_VERSION, season.settings, season.teams, games))
    return hashlib.sha256(inputs.encode()).hexdigest()[:16]
