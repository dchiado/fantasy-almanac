// Which season the navigation points at, from leagueInfo (see "Season phases" in the README).
// Paths here are relative to a league: leaguePath makes them absolute.

// Every league page lives under /league/{id}, so links can be shared
export const leaguePath = (leagueId, path = '') => `/league/${leagueId}${path}`;

// A path with its /league/{id} prefix removed
const LEAGUE_PREFIX = /^\/league\/\d+/;
const withinLeague = (pathname) => pathname.replace(LEAGUE_PREFIX, '') || '/';

// The season under way, or about to start in preseason
export const currentSeason = (leagueInfo) => Number(leagueInfo?.year) || null;

// The newest season with a full recap: this one once every week is played, else last year's
export const latestRecapSeason = (leagueInfo) => {
  const year = currentSeason(leagueInfo);
  if (!year) return null;
  return leagueInfo.phase === 'offseason' ? year : year - 1;
};

// The current season has nothing to show before its draft
export const seasonStarted = (leagueInfo) => leagueInfo?.phase !== 'preseason';

// The current season's pages, by path
const THIS_SEASON_PATHS = [
  { path: '/recap', key: 'recap' },
  { path: '/power-rankings', key: 'rankings' },
  { path: '/standings', key: 'standings' },
  { path: '/playoffs', key: 'playoffs' },
];

// The current season's page keys
export const THIS_SEASON_KEYS = THIS_SEASON_PATHS.map((page) => page.key);

// A league without playoffs races for first place
export const raceTitle = (leagueInfo) => {
  if (leagueInfo?.hasPlayoffs === false) {
    return 'Title race';
  }

  return 'Playoff race';
};

// The current season's pages: tabs in the desktop header, and sub-tabs under
// "This season" on mobile. Mobile has no room for a Playoff race tab, so its
// Standings page carries the race too.
export const thisSeasonPages = (leagueInfo) => [
  { key: 'recap', label: 'Weekly Recap', shortLabel: 'Recap', to: '/recap' },
  { key: 'rankings', label: 'Power rankings', shortLabel: 'Rankings', to: '/power-rankings' },
  { key: 'standings', label: 'Standings', shortLabel: 'Standings', to: '/standings' },
  { key: 'playoffs', label: raceTitle(leagueInfo), to: '/playoffs', desktopOnly: true },
];

const HISTORY_PATHS = ['/history', '/seasons', '/all-time-standings', '/head-to-head', '/records', '/keepers'];

// A week's recap page
export const recapPath = (year, week) => `/seasons/${year}/weeks/${week}`;

// Which page of the main navigation a path belongs to: 'home', a THIS_SEASON_KEYS
// key, 'history', 'league' or null. The current season's week recaps count as
// the Weekly Recap page.
export const activePage = (fullPathname, leagueInfo) => {
  const pathname = withinLeague(fullPathname);

  if (pathname === '/') {
    return 'home';
  }

  const year = currentSeason(leagueInfo);
  if (year && pathname.startsWith(`/seasons/${year}/weeks/`)) {
    return 'recap';
  }

  const thisSeason = THIS_SEASON_PATHS.find((page) => pathname.startsWith(page.path));
  if (thisSeason) {
    return thisSeason.key;
  }

  if (HISTORY_PATHS.some((p) => pathname.startsWith(p))) {
    return 'history';
  }

  if (pathname.startsWith('/league-info-mobile') || pathname.startsWith('/suggestions')) {
    return 'league';
  }

  return null;
};
