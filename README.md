# Fantasy Almanac

A React app for exploring ESPN Fantasy Football (and Baseball) league history. The frontend calls an API Gateway backed by AWS Lambda functions that fetch data from ESPN's Fantasy API, storing finished seasons in S3.

## Architecture

```
React (S3 + CloudFront)
        │
        ▼
   API Gateway (HTTP API)
        │
   ┌────┴────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼
Lambda    Lambda     Lambda    Lambda ...
        │
        ▼
  ESPN Fantasy API
```

**Stack:** React · AWS Lambda (Python 3.12 / Node.js) · Amazon API Gateway (HTTP API) · S3 + CloudFront

---

## Core rules

The app adds what ESPN doesn't show: league history, comparisons across seasons, and what-ifs. It isn't a reskin of ESPN's current-season pages. If ESPN already shows something well, leave it out.

Everything it shows is **a function of ESPN data**, built so that nothing has to run at a particular time:

1. **Only final data is stored.** A season is final once its ESPN data can't change: every season before the league's current one, and the current season 7 days after its last week is played (time for stat corrections). One week's data (a view loaded with `scoringPeriodId`) is final once ESPN is two weeks past it, so the week after it has been played too. Data that isn't final always comes live from ESPN. `season_is_final` and `week_is_final` in the utils layer are the single definitions.
2. **Never save ESPN numbers that can't be fetched again.** Some ESPN values only exist "now", like the playoff % in `mStandings`. Compute our own version from final data instead, so it works for every past season and a missed week costs nothing.
3. **Compute lazily, store by input.** Derived results are computed on first request and saved under a key that names what they depend on: league, season, week, and a model version (`-v2`). Changing a model means bumping the version, not cleaning up old data.
4. **No scheduled jobs.** If something fails, the next request recomputes it. `POST /cache` is a manual backfill that's safe to rerun.
5. **Stored data is served only after ESPN grants access.** Every request makes one live `mStatus` call first. If ESPN refuses it (a private league without a valid `espn_s2`), nothing is read from S3.
6. **Missing beats wrong.** If a league uses a rule we haven't checked against ESPN (such as a seeding tiebreaker), fail clearly instead of guessing. Check rules against ESPN's own results for past seasons (`scripts/check_seeding.py`).

### S3 layout (`ffalmanac-data`)

```
espn-cache/{league}/{year}/{view}.json                 raw ESPN, final seasons only
espn-cache/{league}/{year}/weeks/{week}/{view}.json    raw ESPN for one scoring period
espn-cache/{league}/{year}/_finality.json              when every week was first seen played
derived/{league}/{year}/season-report-v{n}.json        season report (GET /season) for a final season
derived/{league}/{year}/season-report-v{n}-{inputs}.json   ... for a season in progress, by a hash of its decided games
derived/{league}/{year}/weeks/{week}/recap-v{n}.json         weekly recap (GET /recap) for a final week
derived/{league}/{year}/weeks/{week}/recap-v{n}-{inputs}.json   ... for a week not yet final, by a hash of its scores
derived/{league}/{year}/lineups-v{n}.json              points left on the bench (GET /lineups) for a final season
derived/{league}/{year}/lineups-v{n}-{inputs}.json     ... for a season in progress, by a hash of its decided games
power_rankings/league_{league}/{year}/week_{week}/     AI writeups (rankings.md) and their status.json
```

## Season phases

Each league's current season is in one phase. `/info` returns it as `phase` (along with `regular_season_weeks`, `regular_season_weeks_left` and `has_playoffs`, false when first place wins the title), and the frontend keeps it in `leagueInfo`.

| Phase | When | Home leads with |
| --- | --- | --- |
| `preseason` | League rolled over, not drafted yet | Last season's recap |
| `regular_season` | 4+ regular-season weeks left | Last week's recap, power rankings, playoff odds |
| `stretch_run` | Last 3 regular-season weeks | Last week's recap, playoff picture: who's clinched or out, and what each team needs this week |
| `playoffs` | Regular season over, playoffs under way | Regular-season recap, power rankings |
| `offseason` | Every week played | Season recap: champion, collapses, luck |

The phase only changes what Home leads with (`CARDS_BY_PHASE` in `LeagueDashboard.jsx`); every page stays reachable. Past seasons show as an end-of-season recap all year.

Every league page lives under `/league/{leagueId}`, so any link can be shared, and the paths below are relative to it (`leaguePath` in `frontend/src/utils/seasons.js` adds the prefix). `/` opens the last league opened in this browser (the `league_id` cookie), or Gridiron on `gridiron.ffalmanac.com`, else asks for an ID. `/{leagueId}` is a short link to the same place, and the old unprefixed paths redirect to the default league. `League.jsx` loads the league the URL names and asks for `espn_s2` there if it's private, on any page.

Navigation is defined once in `frontend/src/utils/seasons.js`. The current season's pages are **Weekly Recap** (`/recap`: the latest week's recap), **Power rankings** (`/power-rankings`), **Standings** (`/standings`: seed order with playoff odds, all-play, expected wins and luck beside the record, points left on the bench, the schedule swap) and **Playoff race** (`/playoffs`, Title race without playoffs: the stretch-run picture and odds by week). These sit next to **History** (`/history`: past seasons, all-time standings at `/all-time-standings`, head-to-head, records, keepers). On desktop they're the header tabs. On mobile the bottom bar is Home · This season · History · League, and This season opens on Weekly Recap and has sub-tabs for Recap, Rankings and Standings. With no room for a fourth, Standings shows the playoff race too, after the rest. A past season's recap is `/seasons/{year}`, and any week's recap is `/seasons/{year}/weeks/{week}` (linked from Home and from the season recap).

---

## Repo structure

```
lambdas/
  # Football — Python
  leagueInfo/             GET /info
  season/                 GET /season   (season report: playoff odds, scenarios, luck)
                          GET /recap    (weekly recap: high score, luck, pickups, bench blunders, odds movers)
                          GET /lineups  (points left on the bench over a regular season)
  standings/              GET /standings
  headToHeadForm/         GET /head-to-head-form
  headToHead/             GET /head-to-head
  powerRankings/          GET /power-rankings
  individualWeeks/        GET /individual-weeks
  individualSeasons/      GET /individual-seasons
  matchups/               GET /matchups
  keepers/                GET /keepers
  # Football — JS
  cache/                  POST /cache
  cacheStatus/            GET /cache/status
  writePowerRankings/        no route — invoked directly, writes AI rankings to S3
  # Baseball — JS
  baseballOverallStandings/  GET /baseball/overall-standings
  baseballDailyScores/       no route — daily MLB scores email via SES
utils_layer/python/     Shared Python layer
  utils/                  Loading ESPN data: S3 archive, finality, phases
  engine/                 Pure season logic (model, seeding, odds, scenarios, luck); no AWS or ESPN calls
frontend/               React app (CRA)
docs/
  espn-api/             Reference for ESPN's (unofficial) Fantasy API, with sample responses
  season-engine.md      How seeding, playoff odds, scenarios and luck work
  proposals/            Write-ups for possible future features
tests/                  Unit tests for engine/
scripts/                Local checks against ESPN: check_seeding.py, check_odds.py, check_scenarios.py
template.yaml           AWS SAM template
samconfig.toml          SAM deploy config (dev + prod)
```

---

## Lambda development

> The app does not run locally — lambdas call ESPN's API and require AWS. Develop against the `dev` stack and promote to `prod` when ready.

### Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- AWS credentials configured (`aws configure`)

### Deploy to dev

```bash
sam build
sam deploy --config-env dev
```

The API URL is printed at the end of the deploy as `ApiUrl`. Set it in `frontend/.env.local`:

```
REACT_APP_API_URL=https://<id>.execute-api.us-east-2.amazonaws.com/dev
```

### Deploy to prod

```bash
sam build
sam deploy --config-env prod
```

Prod requires a changeset confirmation (`confirm_changeset = true` in `samconfig.toml`).

### Season engine

Season features are built on `utils_layer/python/engine/`, which takes ESPN data and returns plain data with no AWS or ESPN calls. Lambdas get a parsed season from `utils.load_season(year, league_id)` (cached like any other ESPN data), then pass it to engine functions. New features should read the `Season` model rather than raw ESPN views.

The engine needs only the Python standard library, so it runs locally:

```bash
python3 -m unittest discover tests          # unit tests on made-up seasons
python3 scripts/check_seeding.py 166975     # our playoff seeds vs ESPN's, every past season
ESPN_S2=... python3 scripts/check_seeding.py 166975   # include seasons ESPN only serves with a cookie
python3 scripts/check_odds.py 166975        # playoff odds calibration: predicted vs what happened
python3 scripts/check_scenarios.py 166975   # clinched/eliminated claims vs what happened
```

Don't commit real league responses as test data; they include members' names.

The season pages (Standings, Playoff race, and past-season recaps) all come from one lambda returning one report (`GET /season?leagueId=&year=`, `engine/report.py`): standings, playoff odds by week, highlights (biggest collapse, biggest comeback, the bubble), stretch-run scenarios, luck and the schedule swap grid. Every report is computed on first request and stored: a final season once, a season in progress once per set of decided games (`report_inputs`), so it's recomputed only after a game finishes. That first computation takes about 2 seconds, or about 7 with three weeks of scenarios. Bump `REPORT_VERSION` when the report or a model behind it changes.

The same lambda serves weekly recaps (`GET /recap?leagueId=&year=&week=`, `engine/recap.py`), stored the same way: a final week once, a week not yet final by a hash of its scores. Without `week` it's the latest week whose games are all decided, so a new recap appears as soon as ESPN marks the week's games decided. Computing one loads that week's `mRoster` and `mTransactions2` and every earlier season (for all-time ranks and head-to-head). Bump `RECAP_VERSION` when its output changes.

It also serves points left on the bench over a regular season (`GET /lineups?leagueId=&year=`, `engine/lineups.py`), stored like the report under a hash of its decided games. Computing it loads every regular-season week's `mRoster`. Bump `LINEUPS_VERSION` when its output changes. How the best lineup works is in [docs/season-engine.md](docs/season-engine.md#lineup-efficiency).

How seeding, odds, scenarios and luck work, and how they were checked, is in [docs/season-engine.md](docs/season-engine.md).

### Adding a new lambda

1. Create `lambdas/<name>/index.mjs` with an `export const handler = async (event) => {}`.
2. Add a `AWS::Serverless::Function` resource (and `HttpApi` event if it needs a route) to `template.yaml`.
3. `sam build && sam deploy --config-env dev`.

### Secrets

Secrets are stored in AWS SSM Parameter Store and referenced in `template.yaml` with `{{resolve:ssm:...}}`. To add or update:

```bash
aws ssm put-parameter --name /ffalmanac/ANTHROPIC_API_KEY --value "sk-..." --type SecureString --region us-east-2
```

### Claude costs

Any feature that calls Claude follows the power rankings writeup's guards:

- **Spend limit:** the Anthropic API key is in its own Console workspace with a low monthly limit. It's the only hard cap; the AWS budget only alerts.
- **Allowlist:** only leagues in `AI_LEAGUES` (`template.yaml`, comma-separated) get a writeup. Other leagues get the rankings, and the page leaves the writeup card out. The writer's prompt is written for Gridiron, so check it before adding a league.
- **One call per league-week:** before invoking `writePowerRankings`, `powerRankings` claims `status.json` next to `rankings.md` with a conditional write, so simultaneous page loads make one call. The writer marks it `failed` on any error, and a `pending` marker older than 5 minutes counts as failed. A failed writeup is never retried; delete its `status.json` to try again.
- **No async retries:** `writePowerRankings` has `MaximumRetryAttempts: 0`.

---

## Frontend

React app built with Material UI and Redux Toolkit.

### Local dev

```bash
cd frontend
npm install
# create .env.local pointing at dev API:
echo "REACT_APP_API_URL=https://<dev-api-id>.execute-api.us-east-2.amazonaws.com/dev" > .env.local
npm start
```

### Deploy to prod

```bash
cd frontend
npm run build
aws s3 sync build/ s3://ffalmanac.com
```

CloudFront serves the updated frontend. `index.html` is uploaded with `no-cache` and invalidated so clients never reference a deleted hashed bundle; files under `static/` are content-hashed and safe to cache.

---

## ESPN Fantasy API

The app reads from ESPN's unofficial, undocumented Fantasy API. Public leagues need no auth; private leagues need the user's `espn_s2` cookie.

See [docs/espn-api/](docs/espn-api/README.md) for endpoints, views, errors, gotchas and trimmed sample responses.

---

## TODOs

- Audit seasons cached under the old calendar-year rule. Any 2021–2025 season whose `espn-cache/` objects were written before about January 10 of the next year may have been saved mid-final; delete those objects so they're refetched.
- Lambda reserved concurrency isn't possible while the account's concurrency limit is 10 (AWS requires leaving 10 unreserved). That limit already caps the whole account at 10 concurrent runs. If it's ever raised, set `ReservedConcurrentExecutions` per function (1–2 for Claude callers).
