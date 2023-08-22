# Import flask and datetime module for showing date and time
from flask import Flask, request, session
from flask_cors import CORS
import datetime
import league_info
import standings
import head_to_head
import power_rankings
import scores
import matchups
import rosters

x = datetime.datetime.now()

# Initializing flask app
app = Flask(__name__)
CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

app.secret_key = 'super secret key'
app.config['SESSION_TYPE'] = 'filesystem'


@app.route('/', methods=['GET'])
def health():
    return 'OK'


@app.route('/info', methods=['GET'])
# @cross_origin()
async def home():
    session['league_id'] = request.args.get('leagueId')
    resp = await league_info.summary()
    if "established" in resp:
        session['start_year'] = resp['established']
    return resp


@app.route('/standings', methods=['GET'])
async def all_time_standings():
    session['league_id'] = request.args.get('leagueId')
    resp = await standings.list()
    return resp


@app.route('/head-to-head-form', methods=['GET'])
async def h2h_form():
    session['league_id'] = request.args.get('leagueId')
    resp = await head_to_head.options()
    return resp


@app.route('/head-to-head', methods=['GET'])
async def h2h_results():
    args = request.args
    session['league_id'] = args.get('leagueId')
    team1 = args.get('team1')
    team2 = args.get('team2')
    resp = await head_to_head.all_time(team1, team2)
    return resp


@app.route('/individual-weeks', methods=['GET'])
async def list_weeks():
    args = request.args
    session['league_id'] = args.get('leagueId')
    best = args.get('bestworst') == 'best'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    playoffs = args.get('playoffs') == 'true'
    count = int(args.get('count')) or 10
    resp = await scores.best_and_worst_weeks(
        start_year, end_year, playoffs, count, best
    )
    return resp


@app.route('/individual-seasons', methods=['GET'])
async def list_seasons():
    args = request.args
    session['league_id'] = args.get('leagueId')
    best = args.get('bestworst') == 'best'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    count = int(args.get('count')) or 10
    resp = await scores.best_and_worst_seasons(
        start_year, end_year, count, best
    )
    return resp


@app.route('/matchups', methods=['GET'])
async def list_matchups():
    args = request.args
    session['league_id'] = args.get('leagueId')
    blowouts = args.get('bestworst') == 'worst'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    playoffs = args.get('playoffs') == 'true'
    count = int(args.get('count')) or 10
    resp = await matchups.results(
        start_year, end_year, playoffs, count, blowouts
    )
    return resp


@app.route('/power-rankings', methods=['GET'])
async def get_power_rankings():
    session['league_id'] = request.args.get('leagueId')
    resp = await power_rankings.current()
    return resp


@app.route('/keepers', methods=['GET'])
async def get_keeper_options():
    session['league_id'] = request.args.get('leagueId')
    resp = await rosters.keeper_options()
    return resp


# Running app
if __name__ == '__main__':
    app.run(debug=True)

