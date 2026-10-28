"""Season model: one parse of ESPN's raw views into the teams, settings and
games every season feature works from."""
from dataclasses import dataclass

# Views parse_season needs, in the shape load_data returns them
VIEWS = ('mSettings', 'mMatchupScore', 'mTeam')

# Game tiers. ESPN's playoffTierType is NONE for the regular season and
# WINNERS_BRACKET for the playoffs; anything else (WINNERS_CONSOLATION_LADDER,
# LOSERS_CONSOLATION_LADDER) is a placement or consolation game.
REGULAR = 'regular'
PLAYOFF = 'playoff'
CONSOLATION = 'consolation'
_TIERS = {'NONE': REGULAR, 'WINNERS_BRACKET': PLAYOFF}

# ESPN's scoringEnhancementType. With the top-half bonus, every team also gets
# a win for each week it scores in the top half of the league, and a loss otherwise.
NO_BONUS = 'NONE'
TOP_HALF_BONUS = 'WIN_BONUS_TOP_HALF'
SUPPORTED_BONUSES = (NO_BONUS, TOP_HALF_BONUS)


@dataclass(frozen=True)
class Team:
    id: int
    name: str
    abbrev: str
    logo: str | None
    # The primary owner's SWID. Team IDs get handed between owners over the
    # years, so track people across seasons by this.
    owner_id: str | None
    owner_name: str | None
    division_id: int
    # ESPN's own results, kept to check ours against
    playoff_seed: int | None
    final_rank: int | None


@dataclass(frozen=True)
class Game:
    week: int  # matchup period, which can span several scoring periods
    tier: str  # REGULAR, PLAYOFF or CONSOLATION
    home: int
    away: int | None  # None for a bye
    home_points: float
    away_points: float | None
    decided: bool  # False for byes and games not yet played
    winner: int | None  # None for ties, byes and games not yet played

    @property
    def is_bye(self):
        return self.away is None


@dataclass(frozen=True)
class Settings:
    regular_season_weeks: int
    playoff_team_count: int
    seeding_rule: str  # ESPN's playoffSeedingRule: the tiebreaker
    win_bonus: str  # NO_BONUS, TOP_HALF_BONUS or another scoringEnhancementType
    divisions: dict  # division id -> name
    # Matchup period -> its scoring periods. Usually one each, but a playoff
    # matchup can span two.
    matchup_periods: dict

    @property
    def has_playoffs(self):
        return self.playoff_team_count > 0

    @property
    def spots(self):
        """How many top seeds finish somewhere that counts: the playoff teams,
        or in a league without playoffs only the first, which wins the title."""
        return self.playoff_team_count if self.has_playoffs else 1


@dataclass(frozen=True)
class Season:
    league_id: str
    year: int
    settings: Settings
    teams: dict  # team id -> Team
    games: tuple  # Games, in ESPN's schedule order

    def regular_season_games(self, through_week=None):
        """Decided regular-season games, optionally only up to a week."""
        last = self.settings.regular_season_weeks
        if through_week is not None:
            last = min(last, through_week)
        return [g for g in self.games
                if g.tier == REGULAR and g.decided and g.week <= last]

    def scoring_periods(self, week):
        """The scoring periods (ESPN's scoringPeriodId) a matchup period covers."""
        return self.settings.matchup_periods.get(week, (week,))


@dataclass
class Record:
    team_id: int
    division_id: int
    wins: int = 0
    losses: int = 0
    ties: int = 0
    points_for: float = 0.0
    points_against: float = 0.0

    @property
    def games(self):
        return self.wins + self.losses + self.ties

    @property
    def win_pct(self):
        return (self.wins + self.ties / 2) / self.games if self.games else 0.0


def parse_season(league_id, year, views):
    """Build a Season from raw views, keyed by view name (see VIEWS)."""
    schedule_settings = views['mSettings']['settings']['scheduleSettings']
    scoring_settings = views['mSettings']['settings'].get('scoringSettings', {})
    settings = Settings(
        regular_season_weeks=schedule_settings['matchupPeriodCount'],
        playoff_team_count=schedule_settings['playoffTeamCount'],
        seeding_rule=schedule_settings['playoffSeedingRule'],
        win_bonus=scoring_settings.get('scoringEnhancementType', NO_BONUS),
        divisions={d['id']: d['name'] for d in schedule_settings.get('divisions', [])},
        matchup_periods={int(w): tuple(periods)
                         for w, periods in schedule_settings.get('matchupPeriods', {}).items()},
    )

    mteam = views['mTeam']
    members = {m['id']: m for m in mteam.get('members', [])}
    teams = {t['id']: _parse_team(t, members) for t in mteam['teams']}

    games = tuple(_parse_game(m) for m in views['mMatchupScore']['schedule'])
    return Season(str(league_id), int(year), settings, teams, games)


def _parse_team(team, members):
    owner_id = team.get('primaryOwner') or next(iter(team.get('owners') or []), None)
    member = members.get(owner_id)
    owner_name = None
    if member:
        owner_name = f"{member['firstName'].strip().capitalize()} {member['lastName'].strip().capitalize()}"
    return Team(
        id=team['id'],
        # Older responses split the name into location + nickname
        name=team.get('name') or f"{team.get('location', '')} {team.get('nickname', '')}".strip(),
        abbrev=team.get('abbrev', ''),
        logo=team.get('logo'),
        owner_id=owner_id,
        owner_name=owner_name,
        division_id=team.get('divisionId', 0),
        playoff_seed=team.get('playoffSeed') or None,
        final_rank=team.get('rankCalculatedFinal') or None,
    )


def _parse_game(matchup):
    # A bye has only one side, and ESPN may put it under either key
    sides = [matchup[k] for k in ('home', 'away') if k in matchup]
    home = sides[0]
    away = sides[1] if len(sides) > 1 else None

    result = matchup.get('winner', 'UNDECIDED')
    decided = away is not None and result in ('HOME', 'AWAY', 'TIE')
    winner = None
    if decided and result != 'TIE':
        winner = matchup[result.lower()]['teamId']

    return Game(
        week=matchup['matchupPeriodId'],
        tier=_TIERS.get(matchup.get('playoffTierType', 'NONE'), CONSOLATION),
        home=home['teamId'],
        away=away['teamId'] if away else None,
        home_points=home.get('totalPoints', 0.0),
        away_points=away.get('totalPoints', 0.0) if away else None,
        decided=decided,
        winner=winner,
    )


def last_played_week(season):
    """The last week, regular season or playoffs, whose games are all decided
    (0 if none). Consolation games and playoff byes don't count."""
    weeks = {}
    for game in season.games:
        if game.tier != CONSOLATION and not game.is_bye:
            weeks.setdefault(game.week, []).append(game.decided)
    last = 0
    for week in sorted(weeks):
        if not all(weeks[week]):
            break
        last = week
    return last


def records(season, through_week=None, bonus=True):
    """Regular-season records, optionally only up to a week. Returns team id -> Record.

    The league's weekly bonus wins and losses are included, as in ESPN's
    standings, unless `bonus` is False (head-to-head games only)."""
    recs = {t.id: Record(t.id, t.division_id) for t in season.teams.values()}
    games = season.regular_season_games(through_week)
    for game in games:
        sides = ((game.home, game.home_points, game.away_points),
                 (game.away, game.away_points, game.home_points))
        for team_id, points, opponent_points in sides:
            record = recs[team_id]
            record.points_for += points
            record.points_against += opponent_points
            # ESPN's winner, not the points: some leagues break equal scores
            if game.winner is None:
                record.ties += 1
            elif game.winner == team_id:
                record.wins += 1
            else:
                record.losses += 1

    if bonus and season.settings.win_bonus == TOP_HALF_BONUS:
        for scores in _finished_week_scores(season, games):
            for team_id, result in top_half_bonus(scores).items():
                add_result(recs[team_id], result)
    return recs


def add_result(record, result):
    """Count a "win", "loss" or "tie" in a Record."""
    if result == 'win':
        record.wins += 1
    elif result == 'loss':
        record.losses += 1
    else:
        record.ties += 1


def top_half_bonus(scores):
    """One week's TOP_HALF_BONUS results: a win for each team scoring in the top
    half, a loss for the rest. Teams level on the halfway line each get a tie;
    that's a guess, as no league we've checked has had one.

    Args:
        scores: team -> points, for every team that played that week

    Returns:
        team -> "win" | "loss" | "tie"
    """
    if len(scores) < 2:
        return {}

    ranked = sorted(scores.values(), reverse=True)
    half = len(ranked) // 2
    last_in, first_out = ranked[half - 1], ranked[half]

    results = {}
    for team, points in scores.items():
        if points == last_in == first_out:
            results[team] = 'tie'
        elif points >= last_in:
            results[team] = 'win'
        else:
            results[team] = 'loss'
    return results


def _finished_week_scores(season, decided_games):
    """team id -> points for each week in `decided_games` whose games are all
    decided. A week still being played has no bonus yet."""
    weeks = {}
    for game in decided_games:
        scores = weeks.setdefault(game.week, {})
        scores[game.home] = game.home_points
        scores[game.away] = game.away_points

    unfinished = {g.week for g in season.games
                  if g.tier == REGULAR and not g.is_bye and not g.decided}
    return [scores for week, scores in weeks.items() if week not in unfinished]
