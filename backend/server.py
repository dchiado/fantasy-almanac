# Import flask and datetime module for showing date and time
from flask import Flask, request, session
import datetime
import league_info
import standings
import head_to_head
import power_rankings
import scores
import matchups

x = datetime.datetime.now()
  
# Initializing flask app
app = Flask(__name__)
app.secret_key = 'super secret key'
app.config['SESSION_TYPE'] = 'filesystem'

  
@app.route('/info')
async def home():
    session['league_id'] = request.args.get('leagueId')
    resp = await league_info.summary()
    if "established" in resp:
        session['start_year'] = resp['established']
    return resp
  
      
@app.route('/standings')
async def all_time_standings():
    resp = await standings.list()
    return resp


@app.route('/head-to-head-form', methods=['POST', 'GET'])
async def h2h_form():
    resp = await head_to_head.options()
    return resp


@app.route('/head-to-head')
async def h2h_results():
    args = request.args
    team1 = args.get('team1')
    team2 = args.get('team2')
    resp = await head_to_head.all_time(team1, team2)
    return resp


@app.route('/individual-weeks')
async def list_weeks():
    args = request.args
    best = args.get('bestworst') == 'best'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    playoffs = args.get('playoffs') == 'true'
    count = int(args.get('count')) or 10
    resp = await scores.best_and_worst_weeks(
        start_year, end_year, playoffs, count, best
    )
    return resp


@app.route('/individual-seasons')
async def list_seasons():
    args = request.args
    best = args.get('bestworst') == 'best'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    count = int(args.get('count')) or 10
    resp = await scores.best_and_worst_seasons(
        start_year, end_year, count, best
    )
    return resp


@app.route('/matchups')
async def list_matchups():
    args = request.args
    blowouts = args.get('bestworst') == 'worst'
    start_year = args.get('startyear') or None
    end_year = args.get('endyear') or None
    playoffs = args.get('playoffs') == 'true'
    count = int(args.get('count')) or 10
    resp = await matchups.results(
        start_year, end_year, playoffs, count, blowouts
    )
    return resp


@app.route('/power-rankings')
async def get_power_rankings():
    resp = await power_rankings.current()
    return resp


# Running app
if __name__ == '__main__':
    app.run(debug=True)

