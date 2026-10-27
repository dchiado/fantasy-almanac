"""Check engine.scenarios against what actually happened in past seasons.

    python3 scripts/check_scenarios.py 166975
    ESPN_S2=... python3 scripts/check_scenarios.py 166975 --start 2005
    python3 scripts/check_scenarios.py 166975 --data-dir path/to/saved   # {year}/{view}.json

For every past season, with 3, 2 and 1 regular-season weeks left: clinched
teams must have made the playoffs and eliminated teams must have missed;
teams that were "in if they win out" and did must have made it; and when a
team's clinch or elimination condition for that week came true, so must the
outcome. Exits non-zero on any violation.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'utils_layer' / 'python'))

from check_seeding import add_season_args, load_season, season_years  # noqa: E402
from engine.scenarios import SCENARIO_WEEKS, playoff_scenarios  # noqa: E402
from engine.season import REGULAR  # noqa: E402


def condition_met(condition, results):
    """Whether a scenario condition held, given team id -> 'win' / 'loss' that week."""
    met = [results.get(c["team_id"]) == c["result"] for c in condition.get("all", condition.get("any", []))]
    return all(met) if "all" in condition else any(met)


def check_season(season):
    """Returns (checks made, list of violation messages)."""
    final = season.settings.regular_season_weeks
    made = {t.id for t in season.teams.values()
            if t.playoff_seed and t.playoff_seed <= season.settings.playoff_team_count}
    names = {t.id: t.name for t in season.teams.values()}
    checks, problems = 0, []

    for through in range(final - SCENARIO_WEEKS, final):
        scenarios = playoff_scenarios(season, through)
        week_results = {}
        for g in season.games:
            if g.tier == REGULAR and g.week == scenarios["week"] and g.winner is not None:
                loser = g.away if g.winner == g.home else g.home
                week_results.update({g.winner: 'win', loser: 'loss'})
        won_out = {t for t in season.teams
                   if all(g.winner == t for g in season.regular_season_games()
                          if g.week > through and t in (g.home, g.away))}

        for team in scenarios["teams"]:
            t, status = team["team_id"], team["status"]
            claims = []
            if status == "clinched":
                claims.append(("clinched", True))
            if status == "eliminated":
                claims.append(("eliminated", False))
            if status == "win_out" and t in won_out:
                claims.append(("in if it won out, and did", True))
            for key, expected in (("clinch", True), ("eliminate", False)):
                condition = team[key]
                if condition and not condition.get("complex") and condition_met(condition, week_results):
                    claims.append((f"{key} condition met in week {scenarios['week']}", expected))
            for claim, expected in claims:
                checks += 1
                if (t in made) != expected:
                    problems.append(f'after week {through}: {names[t]} {claim}, but '
                                    f'{"made" if t in made else "missed"} the playoffs')
    return checks, problems


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_season_args(parser)
    args = parser.parse_args()

    failed = False
    for year in season_years(args):
        season = load_season(args, year)
        if season is None:
            continue
        if any(t.playoff_seed is None for t in season.teams.values()):
            print(f'{year}  skipped: ESPN has no final seeds')
            continue
        checks, problems = check_season(season)
        failed |= bool(problems)
        print(f'{year}  {"MISMATCH" if problems else "ok"} ({checks} claims checked)')
        for problem in problems:
            print(f'  {problem}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
