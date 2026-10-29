"""A weekly recap's stories as plain sentences, for Claude to turn into a
short summary at the top of the recap. Every name and number Claude may use is
in these sentences; it never sees the recap itself. See "Weekly recap summary"
in docs/season-engine.md."""
import hashlib
import json

# Bump when the facts or the writer's prompt change, so summaries are rewritten
SUMMARY_VERSION = 4


def recap_facts(recap, championship=False):
    """The recap (engine/recap.py weekly_recap) as a list of sentences.

    championship: whether the week is the final, the last week of the playoffs.
    """
    names = owner_names(recap["teams"])

    def name(team_id):
        return names[team_id]

    facts = [_week_fact(recap, championship)]

    for game in recap["games"]:
        facts.append(_game_fact(game, name))

    facts.append(f"High score: {name(recap['high_score']['team_id'])}, {_points(recap['high_score']['points'])}.")
    facts.append(f"Low score: {name(recap['low_score']['team_id'])}, {_points(recap['low_score']['points'])}.")
    facts += _all_time_facts(recap, name)

    if recap.get("biggest_win"):
        facts.append(f"Biggest win: {_margin_text(recap['biggest_win'], name)}.")

    # With one game (the final), the closest win is the biggest one
    if recap.get("closest_win") and len(recap["games"]) > 1:
        facts.append(f"Closest win: {_margin_text(recap['closest_win'], name)}.")

    facts += _luck_facts(recap, name)

    if recap.get("had_who"):
        found = recap["had_who"]
        player = found["player"]
        facts.append(f"Best player on a losing team: {player['name']} ({player['position']}) scored "
                     f"{_points(player['points'])} for {name(found['team_id'])}, who lost to "
                     f"{name(found['opponent_id'])} anyway.")

    if recap.get("best_pickup"):
        facts.append(_pickup_fact(recap["best_pickup"], name))

    facts += _bench_facts(recap, name)

    if recap.get("odds_movers"):
        facts += _odds_facts(recap, name)

    if recap.get("game_of_the_week"):
        facts.append(_game_of_the_week_fact(recap, name))

    return facts


def owner_names(teams):
    """team id -> what the summary calls its manager: the owner's first name,
    with a last initial when two owners share one ("Connor A."), or the team
    name for a team without an owner."""
    def split(team):
        parts = (team.get("owner_name") or "").split()
        return (parts[0], parts[-1][0] if len(parts) > 1 else "") if parts else None

    first_names = [split(t)[0] for t in teams if split(t)]
    names = {}
    for team in teams:
        parts = split(team)
        if parts is None:
            names[team["team_id"]] = team["name"].strip()  # some team names end in spaces
        elif first_names.count(parts[0]) > 1 and parts[1]:
            names[team["team_id"]] = f"{parts[0]} {parts[1]}."
        else:
            names[team["team_id"]] = parts[0]
    return names


def summary_inputs(facts):
    """A short hash of the facts and SUMMARY_VERSION: a summary is stored
    under it, so it's rewritten only when the facts change."""
    inputs = json.dumps([SUMMARY_VERSION, facts])
    return hashlib.sha256(inputs.encode()).hexdigest()[:16]


def _points(n):
    """120.5, not 120.50"""
    return f"{round(n, 2):g}"


def _pct(p):
    """Simulated odds are never certain, so 0 and 1 read "<1%" and ">99%"
    (as on the page, season/format.js)."""
    if p < 0.005:
        return "<1%"
    if p >= 0.995:
        return ">99%"
    return f"{round(p * 100)}%"


def _ordinal(n):
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f"{n}{suffix}"


def _week_fact(recap, championship):
    if championship:
        return f"This is the championship week of the {recap['year']} season."
    if recap["playoffs"]:
        return f"This is week {recap['week']} of the {recap['year']} season, in the playoffs."
    return (f"This is week {recap['week']} of the {recap['year']} regular season, "
            f"which has {recap['regular_season_weeks']} weeks.")


def _game_fact(game, name):
    """The result, then each side's top scorer when there are player points."""
    kind = "Playoff game" if game["playoff"] else "Game"
    home = (game["home"], game["home_points"], game.get("home_top"))
    away = (game["away"], game["away_points"], game.get("away_top"))
    if game["winner"] is None:
        fact = f"{kind}: {name(home[0])} and {name(away[0])} tied, {_points(home[1])} to {_points(away[1])}."
        sides = (home, away)
    else:
        winner, loser = (home, away) if game["winner"] == game["home"] else (away, home)
        fact = f"{kind}: {name(winner[0])} beat {name(loser[0])}, {_points(winner[1])} to {_points(loser[1])}."
        sides = (winner, loser)

    tops = [f"{top['name']} ({top['position']}, {_points(top['points'])}) for {name(team_id)}"
            for team_id, _, top in sides if top]
    if tops:
        fact += f" Top scorers: {'; '.join(tops)}"
        # A name like "Connor J." already ends the sentence
        if not fact.endswith("."):
            fact += "."
    return fact


def _all_time_facts(recap, name):
    """Scores in the top or bottom 5% of league history. Exact ranks only near
    the top, as on the page (recapItems.js)."""
    all_time = recap.get("all_time")
    if not all_time:
        return []

    facts = []
    for score in all_time["scores"]:
        kind = "highest" if score["kind"] == "high" else "lowest"
        if score["rank"] == 1:
            rank = f"the {kind} score"
        elif score["rank"] <= 25:
            rank = f"the {_ordinal(score['rank'])}-{kind} score"
        else:
            rank = f"among the {kind} scores"
        facts.append(f"{name(score['team_id'])}'s {_points(score['points'])} is {rank} of "
                     f"{all_time['count']} scores in league history since {all_time['since']}.")
    return facts


def _margin_text(game, name):
    return (f"{name(game['team_id'])} beat {name(game['opponent_id'])} by {_points(game['margin'])}, "
            f"{_points(game['points'])} to {_points(game['opponent_points'])}")


def _luck_facts(recap, name):
    facts = []
    lucky = recap.get("luckiest_win")
    if lucky:
        place = _ordinal(lucky["of"] - lucky["place"] + 1)
        facts.append(f"Luckiest win: {name(lucky['team_id'])} had the {place}-lowest score of the week "
                     f"and still beat {name(lucky['opponent_id'])}, {_points(lucky['points'])} to "
                     f"{_points(lucky['opponent_points'])}.")

    unlucky = recap.get("unluckiest_loss")
    if unlucky:
        place = _ordinal(unlucky["place"])
        facts.append(f"Unluckiest loss: {name(unlucky['team_id'])} had the {place}-highest score of the week "
                     f"and still lost to {name(unlucky['opponent_id'])}, {_points(unlucky['points'])} to "
                     f"{_points(unlucky['opponent_points'])}.")
    return facts


def _pickup_fact(pickup, name):
    player = pickup["player"]
    if pickup["type"] == "waiver" and pickup["bid_amount"]:
        how = f"a ${pickup['bid_amount']} waiver claim"
    elif pickup["type"] == "waiver":
        how = "a waiver claim"
    else:
        how = "a free-agent add"

    fact = (f"Best pickup: {player['name']} ({player['position']}), {how} by {name(pickup['team_id'])}, "
            f"scored {_points(player['points'])}")
    if not player["starter"]:
        fact += " on the bench"
    if pickup["won_it"]:
        fact += f", more than their winning margin of {_points(pickup['margin'])}"
    return fact + "."


def _players(players):
    """ "Daniel Jones (36.18) and Trey McBride (20.8)", highest first"""
    ordered = sorted(players, key=lambda p: -p["points"])
    parts = [f"{p['name']} ({_points(p['points'])})" for p in ordered]
    if len(parts) <= 2:
        return " and ".join(parts)
    return ", ".join(parts[:-1]) + ", and " + parts[-1]


def _bench_facts(recap, name):
    facts = []
    blundered = set()
    for b in recap.get("bench_blunders") or []:
        blundered.add(b["team_id"])
        swap = f"benched {_players(b['should_have_started'])}"
        if b["should_have_sat"]:
            swap += f" for {_players(b['should_have_sat'])}"
        else:
            swap += " and left a slot empty"
        facts.append(f"Bench blunder: {name(b['team_id'])} lost to {name(b['opponent_id'])}, "
                     f"{_points(b['points'])} to {_points(b['opponent_points'])}, but their best lineup "
                     f"would have scored {_points(b['best_points'])} and won. They {swap}.")

    # A bench blunder already says how much was left on the bench
    most = recap.get("most_left")
    if most and most["team_id"] not in blundered:
        facts.append(f"Most points left on the bench: {name(most['team_id'])} left {_points(most['left'])}, "
                     f"benching {_players(most['should_have_started'])}.")
    return facts


def _odds_facts(recap, name):
    odds = "Playoff odds" if recap["has_playoffs"] else "Title odds"
    movers = recap["odds_movers"]
    facts = []
    if movers.get("rise"):
        rise = movers["rise"]
        facts.append(f"Biggest rise in {odds.lower()}: {name(rise['team_id'])}, "
                     f"{_pct(rise['before'])} to {_pct(rise['after'])}.")
    if movers.get("fall"):
        fall = movers["fall"]
        facts.append(f"Biggest drop in {odds.lower()}: {name(fall['team_id'])}, "
                     f"{_pct(fall['before'])} to {_pct(fall['after'])}.")

    prize = "a playoff spot" if recap["has_playoffs"] else "the title"
    for team_id in movers.get("clinched") or []:
        facts.append(f"{name(team_id)} clinched {prize}.")
    out = "can no longer make the playoffs" if recap["has_playoffs"] else "can no longer win the title"
    for team_id in movers.get("eliminated") or []:
        facts.append(f"{name(team_id)} {out}.")
    return facts


def _game_of_the_week_fact(recap, name):
    game = recap["game_of_the_week"]
    odds = "playoff odds" if recap["has_playoffs"] else "title odds"

    def side(s):
        text = name(s["team_id"])
        if s["pct"] is not None:
            text += f" ({odds} {_pct(s['pct'])}"
            if s["if_win"] is not None and s["if_loss"] is not None:
                text += f", {_pct(s['if_win'])} with a win, {_pct(s['if_loss'])} with a loss"
            text += ")"
        return text

    fact = f"Biggest game next week (week {game['week']}): {side(game['home'])} against {side(game['away'])}."
    record = game.get("head_to_head")
    if record:
        home, away = game["home"]["team_id"], game["away"]["team_id"]
        if record["home_wins"] + record["away_wins"] + record["ties"] == 0:
            fact += " They've never played each other."
        else:
            fact += (f" All-time series: {name(home)} {record['home_wins']} wins, "
                     f"{name(away)} {record['away_wins']} wins")
            if record["ties"]:
                fact += f", {record['ties']} ties"
            fact += "."
    return fact
