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

// The current season's pages: tabs in the desktop header, and sub-tabs under
// "This season" on mobile
export const THIS_SEASON_PAGES = [
  { key: 'rankings', label: 'Power rankings', shortLabel: 'Rankings', to: '/power-rankings' },
  { key: 'playoffs', label: 'Playoff race', shortLabel: 'Playoff race', to: '/playoffs' },
  { key: 'standings', label: 'Standings', shortLabel: 'Standings', to: '/standings' },
];

// THIS_SEASON_PAGES as named for this league: a league without playoffs races for the title
export const thisSeasonPages = (leagueInfo) => {
  if (leagueInfo?.hasPlayoffs !== false) {
    return THIS_SEASON_PAGES;
  }

  return THIS_SEASON_PAGES.map((page) => (
    page.key === 'playoffs' ? { ...page, label: 'Title race', shortLabel: 'Title race' } : page
  ));
};

// Where mobile's "This season" tab opens: the playoff race once it's the story
export const thisSeasonPath = (leagueInfo) => (
  ['stretch_run', 'playoffs', 'offseason'].includes(leagueInfo?.phase) ? '/playoffs' : '/power-rankings'
);

const HISTORY_PATHS = ['/history', '/seasons', '/all-time-standings', '/head-to-head', '/records', '/keepers'];

// A week's recap page
export const recapPath = (year, week) => `/seasons/${year}/weeks/${week}`;

// Which page of the main navigation a path belongs to: 'home', a THIS_SEASON_PAGES
// key, 'history', 'league' or null. The current season's weekly recaps are led
// from Home, so they count as Home.
export const activePage = (fullPathname, leagueInfo) => {
  const pathname = withinLeague(fullPathname);

  if (pathname === '/') {
    return 'home';
  }

  const year = currentSeason(leagueInfo);
  if (year && pathname.startsWith(`/seasons/${year}/weeks/`)) {
    return 'home';
  }

  const thisSeason = THIS_SEASON_PAGES.find((page) => pathname.startsWith(page.to));
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
