# Proposal: Season phases and a season archive

**Status:** Steps 1 and 2 done (October 2026). Steps 3–6 not started.

## Problem

The app shows the same pages all year. What's useful changes with the calendar: playoff scenarios only matter in the last few weeks, and a season review only makes sense once the season is over. Most of the other proposals (playoff odds, luck, draft review, trades, lineup efficiency) are end-of-season analysis that should also be viewable for every past season, not only the latest.

Building any of that on ESPN numbers saved at a point in time would mean a job that has to run in a certain window, and a missed run couldn't be recovered. We don't want that.

## Goal

- Each league's current season is in a **phase**, and the app leads with what's useful in that phase.
- Every season-level feature works for every past season, computed from ESPN data that no longer changes.
- Nothing has to run at a particular time. Anything can be recomputed later.

The rules this sets for the whole app are in the README under "Core rules" and "Season phases". This page covers the plan.

## Design

### Final data

A season is **final** when its ESPN data can't change any more:

- Seasons before the league's current one (per ESPN) are final.
- The current season is final `FINAL_GRACE_PERIOD` (7 days) after it was first seen with every week played (`latestScoringPeriod > finalScoringPeriod` in `mStatus`). The first sighting is recorded in `espn-cache/{league}/{year}/_finality.json`. The grace period covers stat corrections.

Only final seasons are written to `espn-cache/`. Before this change the rule was "any year that isn't this calendar year", which would have cached the 2026 season during its final week (Dec 31, 2026 – Jan 4, 2027) and never replaced it.

A week is final by the same idea: once the following week has been played and corrected. Results "as of week N" can then be stored permanently in the middle of a season.

### Storage

All in S3. No DynamoDB unless a later feature needs indexed queries (plain-text queries might).

```
ffalmanac-data/
  espn-cache/{league}/{year}/{view}.json                  raw ESPN, final seasons only
  espn-cache/{league}/{year}/weeks/{week}/{view}.json     raw ESPN for one scoring period
  espn-cache/{league}/{year}/_finality.json               when every week was first seen played
  derived/{league}/{year}/{artifact}-v{n}.json            computed per season
  derived/{league}/{year}/through-wk{n}/{artifact}-v{n}.json   computed as of a week
  derived/{league}/all-time/{artifact}-v{n}-thru-{year}.json   computed across final seasons
```

- Derived keys include everything the result depends on: the model version, and for all-time results the last final season. A new final season or a model change is a cache miss, never an invalidation.
- Everything is computed lazily on first request. There are no scheduled jobs. `POST /cache` stays as a manual, rerunnable backfill.
- Raw archives are only read after the live `mStatus` call in the same request succeeds, so a private league's history can't be read without access. The history-only proposal relaxes this for allowlisted leagues only.

### Phases

| Phase | Rule | Lead with |
| --- | --- | --- |
| `preseason` | Not drafted (ESPN has rolled the league over) | Keepers, last season's review |
| `regular_season` | 4+ regular-season weeks left | Power rankings, playoff odds, luck so far |
| `stretch_run` | 1–3 regular-season weeks left, including the current one | Playoff scenarios, odds, clinched and eliminated |
| `playoffs` | Past the regular season, weeks still to play | Bracket odds, regular-season awards, how the odds moved |
| `offseason` | Every week played | Season review, draft review, trades, lineup efficiency |

`/info` returns `phase`, `regular_season_weeks` and `regular_season_weeks_left`. The phase is decided by the current season only. **Every past season is effectively in `offseason`, with everything available.** The phase changes emphasis; it doesn't hide pages.

The phase uses "every week played", not "final", so the review is available as soon as the champion is known. It fills in with corrected numbers once the season is final.

### Time travel

Season features take `year` and `throughWeek`. That gives:

- "What everyone needed going into Week 12 of 2019" for free.
- A way to build and test the stretch-run and playoff screens on past seasons in October.

### Backend

- **Engine package** (`utils_layer/python/engine/`), separate from `utils` so it imports nothing from AWS and runs locally with only the standard library. `utils` loads data; `engine` works on it.
- **Season model** (`engine/season.py`, done): `parse_season` turns `mSettings`, `mMatchupScore` and `mTeam` into `Settings`, `Team`s (with owner SWID and name) and `Game`s (week, tier, both sides, points, winner). `records(season, through_week)` builds regular-season records from ESPN's `winner`, not by comparing points, because some leagues break equal scores. Lambdas call `utils.load_season(year, league_id)`. New features read this, not raw ESPN. It's also the games table for [plain-text queries](plain-text-queries.md).
- **Seeding** (`engine/seeding.py`, done): `seed_teams(records, rule)` orders every team, as described under [Seeding rules](#seeding-rules).
- **Later engine modules:** `simulation.py` (numpy), `scenarios.py`, `luck.py`, then `lineups.py`, `draft.py`, `transactions.py`.
- **One routed lambda** (`SeasonFunction`, Python) for all season features: `GET /season?year=&throughWeek=` returns a bundle for the season page, `GET /season/{artifact}?...` returns one artifact. The account allows 10 concurrent lambdas, so one bundle request beats six parallel ones.
- New engine code stays in Python, for numpy.

### Seeding rules

Observed from Gridiron's 2005–2025 seasons (8 to 12 teams, one to four divisions). All 21 seasons match ESPN's `playoffSeed` for every team:

1. Each division's winner is seeded first, best record first.
2. Every other team follows, best record first.
3. Ties, including ties for a division, go to `playoffSeedingRule`.

Tiebreakers implemented:

- `TOTAL_POINTS_SCORED`: more points for. Checked.
- `H2H_RECORD`: with **two** tied teams, the better record in games between them, then more points for. With **three or more**, ESPN doesn't compare head-to-head across the group. The team with the most points goes first, and the rest are compared again, so head-to-head only decides the last two. Gridiron used this rule in 2005, 2006 and 2012–2014.
  - An earlier version compared each team's head-to-head record against all the other tied teams at once. It matched 2005, 2006 and 2012, but not 2013 (a four-way tie at 8-6) or 2014 (two three-way ties). The rule above matches all five seasons. On a mismatch, the check script prints the games between tied teams.

Any other rule raises `UnsupportedSeedingRule`, so features fail visibly instead of showing wrong seeds. Add a rule when a league that uses it can be checked. What `playoffSeedingRuleBy` means is unknown (Gridiron's is always 0).

To check a league: `python3 scripts/check_seeding.py <leagueId>`, with `ESPN_S2` set for seasons ESPN doesn't serve publicly.

### Frontend

- Navigation: **Home · This Season · Seasons · History**, which fits the mobile bottom bar. Seasons is `/seasons/:year`, a review page per year. History holds the all-time pages (standings, head-to-head, records, and later career luck and draft history). Keepers stays a per-league extra.
- Home picks and orders its cards by phase.
- `leagueInfo` in Redux holds `phase`, `regularSeasonWeeks` and `regularSeasonWeeksLeft`. Add a dev-only `?phase=` override.

## How the other proposals fit

| Proposal | Phase | Notes |
| --- | --- | --- |
| [Playoff odds](playoff-odds.md) | Regular season onward, plus every past season | Build first; the seeding function is the base for scenarios |
| [Luck and schedule](luck-and-schedule.md) | Any phase | No new data; shares the score model with odds |
| [Playoff scenarios](playoff-scenarios.md) | Stretch run, plus past seasons via `throughWeek` | Depends on seeding |
| [Lineup efficiency](lineup-efficiency.md) | Any phase | Uses the weekly cache keys; about 17 ESPN calls per season, once |
| [Draft review](draft-review.md) | Offseason | Check past-season data first; `kona_player_info`'s filter header isn't part of the cache key |
| [Trades and waivers](trades-and-waivers.md) | Offseason | Check that `mTransactions2` keeps past seasons. If not, cover only what ESPN keeps; no snapshot job |
| [Plain-text queries](plain-text-queries.md) | Any phase | Mostly free once the season model exists |
| [History-only mode](history-only-mode.md) | Any phase | Finality makes it reliable: the latest finished season always gets archived |

## Steps

1. **Done.** Finality-aware caching (`load_data`, the in-memory cache, `POST /cache`, `GET /cache/status`), week-keyed cache keys, phase in `/info`, and the fix for the "Include playoffs" filter being ignored.
2. **Done.** Season model (`engine/season.py`, `utils.load_season`) and seeding (`engine/seeding.py`), checked against all 21 Gridiron seasons (2005–2025). Unit tests in `tests/`, ESPN check in `scripts/check_seeding.py`.
3. Playoff odds and luck, `SeasonFunction`, and a basic `/seasons/:year` page.
4. Playoff scenarios and the phase-aware Home, tested on past seasons with `throughWeek`.
5. Data checks for the offseason features (transactions, weekly rosters, drafts), then the full season review.
6. Plain-text queries and history-only mode.

## Open questions

- Seasons cached under the old calendar-year rule may have been written mid-final. Check any 2021–2025 season whose `espn-cache/` objects were written before about January 10 of the next year, and delete it so it's refetched.
- Whether the seven-day grace period is long enough for ESPN's stat corrections.
- Whether `stretch_run` should also start early when the first team clinches or is eliminated.
- What `playoffSeedingRuleBy` means (always 0 for Gridiron).
