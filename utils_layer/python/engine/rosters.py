"""Weekly lineups and pickups, parsed from ESPN's mRoster and mTransactions2 for
one scoring period. See "Gotchas" in docs/espn-api/README.md."""

# lineupSlotId values that aren't in the starting lineup
BENCH_SLOTS = {20, 21}  # bench, IR

# defaultPositionId -> position
POSITIONS = {1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'}


def parse_lineups(mroster, scoring_period):
    """Each team's players for one scoring period.

    Returns:
        team id -> {player id: {"player_id", "name", "position", "slot",
                                "eligible_slots", "starter", "points"}}
        slot is the lineupSlotId; eligible_slots the lineupSlotIds he can fill.
    """
    lineups = {}
    for team in mroster['teams']:
        players = lineups[team['id']] = {}
        for entry in team.get('roster', {}).get('entries', []):
            player = entry['playerPoolEntry']['player']
            # Actual points are statSourceId 0; 1 is ESPN's projection
            points = next((s['appliedTotal'] for s in player.get('stats', [])
                           if s.get('scoringPeriodId') == scoring_period and s.get('statSourceId') == 0), 0.0)
            players[entry['playerId']] = {
                "player_id": entry['playerId'],
                "name": player.get('fullName', ''),
                "position": POSITIONS.get(player.get('defaultPositionId'), ''),
                "slot": entry['lineupSlotId'],
                "eligible_slots": player.get('eligibleSlots', []),
                "starter": entry['lineupSlotId'] not in BENCH_SLOTS,
                "points": points,
            }
    return lineups


def merge_lineups(periods):
    """Lineups for a matchup period spanning several scoring periods: points
    added up, and a player counts as a starter if he started in any of them."""
    merged = {}
    for lineups in periods:
        for team_id, players in lineups.items():
            team = merged.setdefault(team_id, {})
            for player_id, player in players.items():
                if player_id in team:
                    team[player_id] = {**team[player_id],
                                       "starter": team[player_id]["starter"] or player["starter"],
                                       "points": team[player_id]["points"] + player["points"]}
                else:
                    team[player_id] = dict(player)
    return merged


def parse_adds(transactions):
    """Free-agent and waiver adds that went through.

    Returns:
        list of {"player_id", "team_id", "type": "free_agent" | "waiver", "bid_amount"}
    """
    types = {'FREEAGENT': 'free_agent', 'WAIVER': 'waiver'}
    adds = []
    for transaction in transactions:
        if transaction.get('type') not in types or transaction.get('status') != 'EXECUTED':
            continue
        for item in transaction.get('items', []):
            if item.get('type') == 'ADD':
                adds.append({
                    "player_id": item['playerId'],
                    "team_id": item['toTeamId'],
                    "type": types[transaction['type']],
                    "bid_amount": transaction.get('bidAmount') or 0,
                })
    return adds
