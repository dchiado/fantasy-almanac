# Fantasy Almanac

This program compiles data on an ESPN fantasy football league using the public ESPN API. The backend uses python scripts to retrieve and organize the data and is built on [flask](https://flask.palletsprojects.com/en/2.0.x/). The frontend is built with React and was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).


## Prerequisites
1. Python 3 is required, which can be obtained [here](https://www.python.org/downloads).
1. Navigate into the backend directory with `cd backend`
1. Set up your virtual environment. If you name it something other than `env`, make sure to gitignore that dir.
    ```
    python3 -m venv env
    ```
1. Activate your virtual environment.
    ```
    source env/bin/activate
    ```
1. Install all dependencies:
    ```
    pip install -r requirements.txt
    ```
1. Export flask environment variables
    ```
    export FLASK_APP=flaskr
    export FLASK_ENV=development
    ```
1. Install frontend dependencies. Navigate into the frontend directory with `cd frontend` and run:
    ```
    npm install
    ```


## Use
- In one terminal, cd into the `backend` dir and run the flask app with:
    ```
    flask run
    ```
- In another terminal, cd into the `frontend` dir and run the frontend with:
    ```
    npm start
    ```
- The web app will be available at `http://localhost:3000/`


## ESPN API
ESPN has a public API for fantasy leagues that are marked as "publicly accessible". For these,
there is no need for an auth token or key and the API can be accessed with just the league ID.


### Endpoints
The endpoints are not well documented, so there are sample responses inside the `api` directory.
This data is not live but is just for viewing the response structure.

For recent seasons, the endpoint looks like this where endpoint is the name of the json file in
that directory, such as `mDraftDetail`:

`http://fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{league_id}?&view={endpoint}`

For older seasons, the endpoint looks like this:

`https://fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}?seasonId={year}&view={endpoint}`

## UI Components
Material UI is used for building frontend component. Components, examples, and other
documentation can be found [here](https://mui.com/). 
