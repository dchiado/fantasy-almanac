"""How much of each team's record came from luck and the schedule rather than
scoring. See docs/season-engine.md."""
from .season import records

# Games decided by less than this many points count as close
CLOSE_GAME_MARGIN = 5


def luck(season, through_week=None):
    """Per-team luck for the regular season, optionally only up to a week.

    All-play: a team's record if it had played every other team every week.
    Expected wins: the wins its scores were worth on average, i.e. the sum of
    its weekly all-play win percentage. Luck is actual wins minus expected wins.

    Returns:
        list of {"team_id", "wins", "losses", "ties", "all_play_wins",
                 "all_play_losses", "all_play_ties", "expected_wins", "luck",
                 "close_wins", "close_losses"}, luckiest first
    """
    games = season.regular_season_games(through_week)
    recs = records(season, through_week)

    weekly = {}
    for game in games:
        week = weekly.setdefault(game.week, {})
        week[game.home] = game.home_points
        week[game.away] = game.away_points

    teams = {t: {"team_id": t, "wins": r.wins, "losses": r.losses, "ties": r.ties,
                 "all_play_wins": 0, "all_play_losses": 0, "all_play_ties": 0,
                 "expected_wins": 0.0, "close_wins": 0, "close_losses": 0}
             for t, r in recs.items()}

    for scores in weekly.values():
        others = len(scores) - 1
        for team_id, points in scores.items():
            beat = sum(1 for t, p in scores.items() if t != team_id and p < points)
            tied = sum(1 for t, p in scores.items() if t != team_id and p == points)
            team = teams[team_id]
            team["all_play_wins"] += beat
            team["all_play_ties"] += tied
            team["all_play_losses"] += others - beat - tied
            if others:
                team["expected_wins"] += (beat + tied / 2) / others

    for game in games:
        if abs(game.home_points - game.away_points) >= CLOSE_GAME_MARGIN or game.winner is None:
            continue
        loser = game.away if game.winner == game.home else game.home
        teams[game.winner]["close_wins"] += 1
        teams[loser]["close_losses"] += 1

    for team in teams.values():
        team["expected_wins"] = round(team["expected_wins"], 2)
        team["luck"] = round(team["wins"] + team["ties"] / 2 - team["expected_wins"], 2)
    return sorted(teams.values(), key=lambda t: -t["luck"])


def schedule_swap(season, through_week=None):
    """Each team's record against every other team's schedule.

    Team A on team B's schedule plays B's opponent each week; when that
    opponent is A itself, A plays B instead. A team's own row-and-column
    entry is its actual record.

    Returns:
        {"team_ids": [...], "records": [[[wins, losses, ties], ...], ...]}
        records[i][j] is team_ids[i] playing team_ids[j]'s schedule.
    """
    games = season.regular_season_games(through_week)
    team_ids = sorted(season.teams)

    weeks = {}
    for game in games:
        week = weeks.setdefault(game.week, {"points": {}, "opponent": {}})
        week["points"][game.home] = game.home_points
        week["points"][game.away] = game.away_points
        week["opponent"][game.home] = game.away
        week["opponent"][game.away] = game.home

    grid = []
    for a in team_ids:
        row = []
        for b in team_ids:
            wins = losses = ties = 0
            for week in weeks.values():
                if a not in week["points"] or b not in week["opponent"]:
                    continue  # a bye for one of them
                opponent = week["opponent"][b]
                if opponent == a:
                    opponent = b
                mine, theirs = week["points"][a], week["points"][opponent]
                if mine > theirs:
                    wins += 1
                elif mine < theirs:
                    losses += 1
                else:
                    ties += 1
            row.append([wins, losses, ties])
        grid.append(row)
    return {"team_ids": team_ids, "records": grid}
