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

1. **Only final data is stored.** A season is final once its ESPN data can't change: every season before the league's current one, and the current season 7 days after its last week is played (time for stat corrections). Data that isn't final always comes live from ESPN. `season_is_final` in the utils layer is the single definition.
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
power_rankings/league_{league}/{year}/week_{week}/     AI writeups
```

## Season phases

Each league's current season is in one phase. `/info` returns it as `phase` (along with `regular_season_weeks` and `regular_season_weeks_left`), and the frontend keeps it in `leagueInfo`.

| Phase | When | Home leads with |
| --- | --- | --- |
| `preseason` | League rolled over, not drafted yet | Last season's recap |
| `regular_season` | 4+ regular-season weeks left | Power rankings, playoff odds |
| `stretch_run` | Last 3 regular-season weeks | Playoff picture: who's clinched or out, and what each team needs this week |
| `playoffs` | Regular season over, playoffs under way | Regular-season recap, power rankings |
| `offseason` | Every week played | Season recap: champion, collapses, luck |

The phase only changes what Home leads with (`CARDS_BY_PHASE` in `LeagueDashboard.jsx`); every page stays reachable. Past seasons show as an end-of-season recap all year. See [docs/proposals/season-phases.md](docs/proposals/season-phases.md) for the plan.

Navigation is defined once in `frontend/src/utils/seasons.js`. The current season's pages are **Power rankings** (`/power-rankings`), **Playoff race** (`/playoffs`: the stretch-run picture and odds by week) and **Standings** (`/standings`: seed order with playoff odds, all-play, expected wins and luck beside the record), next to **History** (`/history`: past seasons, all-time standings at `/all-time-standings`, head-to-head, records, keepers). On desktop they're the header tabs. On mobile the bottom bar is Home · This season · History · League, and This season has sub-tabs for its three pages. A past season's recap is `/seasons/{year}`.

---

## Repo structure

```
lambdas/
  # Football — Python
  leagueInfo/             GET /info
  season/                 GET /season   (season report: playoff odds, scenarios, luck)
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

The season pages (Playoff race, Standings, and past-season recaps) all come from one lambda returning one report (`GET /season?leagueId=&year=`, `engine/report.py`): standings, playoff odds by week, highlights (biggest collapse, biggest comeback, the bubble), stretch-run scenarios, luck and the schedule swap grid. Every report is computed on first request and stored: a final season once, a season in progress once per set of decided games (`report_inputs`), so it's recomputed only after a game finishes. That first computation takes about 2 seconds, or about 7 with three weeks of scenarios. Bump `REPORT_VERSION` when the report or a model behind it changes.

### Adding a new lambda

1. Create `lambdas/<name>/index.mjs` with an `export const handler = async (event) => {}`.
2. Add a `AWS::Serverless::Function` resource (and `HttpApi` event if it needs a route) to `template.yaml`.
3. `sam build && sam deploy --config-env dev`.

### Secrets

Secrets are stored in AWS SSM Parameter Store and referenced in `template.yaml` with `{{resolve:ssm:...}}`. To add or update:

```bash
aws ssm put-parameter --name /ffalmanac/ANTHROPIC_API_KEY --value "sk-..." --type SecureString --region us-east-2
```

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
- Cap Claude costs (do before adding more AI features):
  - Move the app's Anthropic API key to its own Console workspace with a low monthly spend limit (e.g. $5). This is the only hard cap on Claude spend; the AWS budget only alerts.
  - `powerRankings` calls Claude for any league ID. Add an allowlist (e.g. an `AI_LEAGUES` env var) so only known leagues trigger a writeup.
  - Before invoking `writePowerRankings`, write a "pending" marker to S3 (and a "failed" marker on error), so simultaneous page loads and repeated failures don't each make a Claude call.
- Lambda reserved concurrency isn't possible while the account's concurrency limit is 10 (AWS requires leaving 10 unreserved). That limit already caps the whole account at 10 concurrent runs. If it's ever raised, set `ReservedConcurrentExecutions` per function (1–2 for Claude callers).
