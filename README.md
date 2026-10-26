# Fantasy Almanac

A React app for exploring ESPN Fantasy Football (and Baseball) league history. The frontend calls an API Gateway backed by AWS Lambda functions that fetch data from ESPN's public Fantasy API on the fly.

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

### S3 layout (`ffalmanac-data`)

```
espn-cache/{league}/{year}/{view}.json                 raw ESPN, final seasons only
espn-cache/{league}/{year}/weeks/{week}/{view}.json    raw ESPN for one scoring period
espn-cache/{league}/{year}/_finality.json              when every week was first seen played
derived/{league}/{year}/...                            computed results (planned)
power_rankings/league_{league}/{year}/week_{week}/     AI writeups
```

## Season phases

Each league's current season is in one phase. `/info` returns it as `phase` (along with `regular_season_weeks` and `regular_season_weeks_left`), and the frontend keeps it in `leagueInfo`.

| Phase | When | Lead with |
| --- | --- | --- |
| `preseason` | League rolled over, not drafted yet | Keepers, last season in review |
| `regular_season` | 4+ regular-season weeks left | Power rankings, how the season is going |
| `stretch_run` | Last 3 regular-season weeks | Playoff scenarios: who's in, who's out, what each team needs |
| `playoffs` | Regular season over, playoffs under way | Final regular-season analysis, playoff odds |
| `offseason` | Every week played | End-of-season review |

The phase sets what the app leads with for the **current** season. It doesn't hide pages. Past seasons have all their analysis available all year. See [docs/proposals/season-phases.md](docs/proposals/season-phases.md) for the plan.

---

## Repo structure

```
lambdas/
  # Football — Python
  leagueInfo/             GET /info
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
utils_layer/            Shared Python layer (utils package)
frontend/               React app (CRA)
docs/
  espn-api/             Reference for ESPN's (unofficial) Fantasy API, with sample responses
  proposals/            Write-ups for possible future features
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
