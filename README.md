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

## Repo structure

```
lambdas/
  # Football — Python (TODO: migrate to JS)
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

- Migrate Python lambdas to JS
- Plain text (AI) queries about the history
- Better in-game/season tracking: playoff odds charts, win % charts, etc.
