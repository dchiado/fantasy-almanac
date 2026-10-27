"""Check engine.simulation's playoff odds against what actually happened.

    python3 scripts/check_odds.py 166975
    ESPN_S2=... python3 scripts/check_odds.py 166975 --start 2005
    python3 scripts/check_odds.py 166975 --data-dir path/to/saved   # {year}/{view}.json

For every past season and every week of its regular season, each team's
predicted playoff odds are compared with whether it made the playoffs.
Teams given about 70% should make it about 70% of the time. Prints the
calibration by 10% band and the Brier score (lower is better; always
guessing 50% scores 0.25).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'utils_layer' / 'python'))

from check_seeding import add_season_args, load_season, season_years  # noqa: E402
from engine.seeding import UnsupportedSeedingRule  # noqa: E402
from engine.simulation import completed_weeks, odds_after_week  # noqa: E402


def predictions(season, simulations):
    """(predicted playoff %, made playoffs) for every team and week before the last."""
    final = season.settings.regular_season_weeks
    if completed_weeks(season) < final:
        return []
    made = {t["team_id"] for t in odds_after_week(season, final, 1)["teams"] if t["playoff_pct"] == 1}
    return [(t["playoff_pct"], t["team_id"] in made)
            for week in range(1, final)
            for t in odds_after_week(season, week, simulations)["teams"]]


def report(results):
    brier = sum((p - made) ** 2 for p, made in results) / len(results)
    lines = [f'{len(results)} predictions, Brier score {brier:.3f}',
             '  band      teams  predicted  actual']
    for low in range(0, 100, 10):
        band = [(p, made) for p, made in results
                if low <= p * 100 < low + 10 or (low == 90 and p == 1)]
        if band:
            predicted = sum(p for p, _ in band) / len(band)
            actual = sum(made for _, made in band) / len(band)
            lines.append(f'  {low:>2}-{low + 10:<3}%  {len(band):>6}  {predicted:>8.0%}  {actual:>6.0%}')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_season_args(parser)
    parser.add_argument('--simulations', type=int, default=500)
    args = parser.parse_args()

    results = []
    for year in season_years(args):
        season = load_season(args, year)
        if season is None:
            continue
        try:
            season_results = predictions(season, args.simulations)
        except UnsupportedSeedingRule as e:
            print(f'{year}  skipped: unsupported tiebreaker {e}')
            continue
        print(f'{year}  {len(season_results)} predictions')
        results.extend(season_results)

    if not results:
        sys.exit('No seasons to check')
    print(report(results))


if __name__ == '__main__':
    main()
