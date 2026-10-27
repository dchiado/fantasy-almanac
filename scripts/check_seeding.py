"""Check engine.seeding against ESPN's own playoff seeds for a league's past seasons.

    python3 scripts/check_seeding.py 166975
    ESPN_S2=... python3 scripts/check_seeding.py 166975 --start 2005
    python3 scripts/check_seeding.py 166975 --data-dir path/to/saved   # {year}/{view}.json

Seasons ESPN won't serve without a cookie need ESPN_S2. Exits non-zero if any
season's seeds differ from ESPN's.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'utils_layer' / 'python'))

from engine.season import VIEWS, parse_season, records  # noqa: E402
from engine.seeding import UnsupportedSeedingRule, seed_teams  # noqa: E402

BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'
AUTH_ERROR = 'AUTH_LEAGUE_NOT_VISIBLE'


def fetch(league_id, year, view):
    """Fetch a view, trying the seasons endpoint before leagueHistory.

    ESPN sometimes serves an old season publicly through /seasons/ but not
    through leagueHistory, so the seasons endpoint goes first."""
    urls = [f'{BASE}/seasons/{year}/segments/0/leagues/{league_id}?view={view}',
            f'{BASE}/leagueHistory/{league_id}?seasonId={year}&view={view}']
    headers = {'User-Agent': 'Mozilla/5.0'}
    if os.environ.get('ESPN_S2'):
        headers['Cookie'] = f"espn_s2={os.environ['ESPN_S2']}"

    errors = []
    for url in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as resp:
                data = json.load(resp)
            return data[0] if isinstance(data, list) else data
        except urllib.error.HTTPError as e:
            body = json.loads(e.read() or b'{}')
            errors.append((body.get('details') or [{}])[0].get('type', f'HTTP {e.code}'))
    # leagueHistory says GENERAL_NOT_FOUND for private seasons, so prefer the auth error
    raise RuntimeError(AUTH_ERROR if AUTH_ERROR in errors else errors[0])


def load_views(league_id, year, data_dir):
    if data_dir:
        return {v: json.loads((Path(data_dir) / str(year) / f'{v}.json').read_text()) for v in VIEWS}
    return {v: fetch(league_id, year, v) for v in VIEWS}


def default_years(league_id):
    """Every season before the league's current one, which are all final."""
    this_year = date.today().year
    current = None
    for year in (this_year, this_year - 1):
        try:
            status = fetch(league_id, year, 'mStatus')
        except RuntimeError as e:
            # A private current season still exists; earlier ones may be public.
            # GENERAL_NOT_FOUND means ESPN hasn't rolled the league over yet.
            if str(e) == AUTH_ERROR and current is None:
                current = year
            continue
        current = current or status['seasonId']
        first = (status['status']['previousSeasons'] or [status['seasonId']])[0]
        return range(first, current)
    sys.exit("Couldn't read the league's seasons from ESPN. Private? Set ESPN_S2.")


def add_season_args(parser):
    """Arguments every check script takes: the league and which seasons to check."""
    parser.add_argument('league_id')
    parser.add_argument('--start', type=int, help="first season (default: the league's first)")
    parser.add_argument('--end', type=int, help='last season (default: the one before the current season)')
    parser.add_argument('--data-dir', help='read {year}/{view}.json from here instead of ESPN')


def season_years(args):
    """The seasons to check, from add_season_args' arguments."""
    if args.start and args.end:
        return range(args.start, args.end + 1)
    if args.data_dir:
        sys.exit('--start and --end are required with --data-dir')
    years = default_years(args.league_id)
    return range(args.start or years.start, (args.end or years.stop - 1) + 1)


def load_season(args, year):
    """Load one season, or print why it was skipped and return None."""
    try:
        return parse_season(args.league_id, year, load_views(args.league_id, year, args.data_dir))
    except (RuntimeError, OSError) as e:
        # Without a cookie, ESPN reports private old seasons as not found
        hint = '' if os.environ.get('ESPN_S2') or args.data_dir else ' (private? set ESPN_S2)'
        print(f'{year}  skipped: {e}{hint}')
        return None


def check_season(season):
    """Returns (ok, message)."""
    if any(t.playoff_seed is None for t in season.teams.values()):
        return None, 'skipped: ESPN has no final seeds'
    try:
        ours = seed_teams(records(season).values(), season.settings.seeding_rule,
                          season.regular_season_games())
    except UnsupportedSeedingRule as e:
        return None, f'skipped: unsupported tiebreaker {e}'

    espn = sorted(season.teams, key=lambda team_id: season.teams[team_id].playoff_seed)
    if ours == espn:
        return True, f'ok ({len(ours)} teams, {len(season.settings.divisions)} divisions, {season.settings.seeding_rule})'

    recs = records(season)
    lines = ['MISMATCH', '  seed  ours (W-L-T, PF, div)              espn']
    for seed, (a, b) in enumerate(zip(ours, espn), start=1):
        r = recs[a]
        flag = '' if a == b else '  <--'
        lines.append(f'  {seed:>4}  {season.teams[a].name[:20]:<20} '
                     f'{r.wins}-{r.losses}-{r.ties} {r.points_for:8.2f} d{r.division_id}  '
                     f'{season.teams[b].name[:20]}{flag}')
    if season.settings.seeding_rule == 'H2H_RECORD':
        lines.extend(head_to_head_lines(season, recs))
    return False, '\n'.join(lines)


def head_to_head_lines(season, recs):
    """Games between teams with the same record, to see how ESPN broke the tie."""
    lines = []
    groups = {}
    for r in recs.values():
        groups.setdefault((r.wins, r.losses, r.ties), set()).add(r.team_id)
    for (wins, losses, ties), team_ids in sorted(groups.items(), reverse=True):
        if len(team_ids) < 2:
            continue
        lines.append(f'  head-to-head among teams at {wins}-{losses}-{ties}:')
        for g in season.regular_season_games():
            if g.home in team_ids and g.away in team_ids:
                lines.append(f'    wk {g.week:>2}  {season.teams[g.home].name[:20]:<20} {g.home_points:6.2f}'
                             f' - {g.away_points:6.2f}  {season.teams[g.away].name[:20]}')
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_season_args(parser)
    args = parser.parse_args()

    failed = False
    for year in season_years(args):
        season = load_season(args, year)
        if season is None:
            continue
        ok, message = check_season(season)
        failed |= ok is False
        print(f'{year}  {message}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
