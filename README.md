# Fantasy Almanac

Fantasy Almanac is a React web application for exploring historical ESPN Fantasy Football league data. It retrieves league information from ESPN's public Fantasy API, processes the data with serverless Python functions running on AWS Lambda, and presents the results through an interactive web interface.

## Architecture

```text
                   +----------------------+
                   |   React Frontend     |
                   |   S3 + CloudFront    |
                   +----------+-----------+
                              |
                              v
                   +----------------------+
                   |     API Gateway      |
                   +----------+-----------+
                              |
                +-------------+-------------+
                |             |             |
                v             v             v
         +------------+ +------------+ +------------+
         |  Lambda 1  | |  Lambda 2  | |  Lambda N  |
         +------------+ +------------+ +------------+
                              |
                              v
                   +----------------------+
                   | ESPN Fantasy API     |
                   +----------------------+
```

### Tech Stack

- **Frontend:** React
- **Backend:** Python on AWS Lambda
- **API:** Amazon API Gateway
- **Hosting:** Amazon S3 + CloudFront
- **Data Source:** ESPN Fantasy Football API

---

## Local Development

### Prerequisites

- Python 3
- Node.js and npm

### Backend

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python3 -m venv env
source env/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

> **Note:** The production backend runs as AWS Lambda functions. Running the full backend locally requires additional setup or local Lambda tooling. During development you can either invoke the deployed API Gateway endpoints or run individual handlers locally for testing.

### Frontend

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```text
REACT_APP_API_URL=http://localhost:5000
```

Start the development server:

```bash
npm start
```

The application will be available at:

```
http://localhost:3000
```

---

## Deployment

### Backend

The backend consists of multiple AWS Lambda functions exposed through Amazon API Gateway.

Deployment is currently manual by packaging and uploading updated Lambda code through AWS.

### Frontend

Update the environment variables as needed, then build the production bundle:

```bash
cd frontend
npm run build
```

Upload the contents of `frontend/build` to the S3 bucket hosting the static site.

CloudFront will serve the updated frontend.

---

## ESPN Fantasy API

ESPN exposes a public API for fantasy football leagues marked as publicly accessible.

For public leagues, no authentication is required.

> **Note:** ESPN does not officially document these endpoints, and they occasionally change. If requests suddenly begin failing, one of the first things to check is whether the base URLs have changed.

### Current Endpoints

For **2020 and newer**:

```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{league_id}?view={endpoint}
```

For **2019 and older**:

```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}?seasonId={year}&view={endpoint}
```

An optional scoring period can be specified by appending:

```
&scoringPeriodId={week}
```

### Previous Base URLs

Historically, these endpoints used the `fantasy.espn.com` domain instead of `lm-api-reads.fantasy.espn.com`:

Recent seasons:

```
https://fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{league_id}?view={endpoint}
```

Older seasons:

```
https://fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}?seasonId={year}&view={endpoint}
```

Sample API responses are included in the `api/` directory for reference.

Private leagues require the appropriate ESPN authentication cookies (`espn_s2` and `SWID`).

## Frontend

The frontend is built with React and Material UI.

The primary environment variable is:

```text
REACT_APP_API_URL
```

which should point to the appropriate API Gateway endpoint for the target environment.

---

## Future Improvements

- Automate Lambda deployment
- Add CI/CD for frontend and backend deployments
- Manage AWS infrastructure as code
- Improve local Lambda development experience