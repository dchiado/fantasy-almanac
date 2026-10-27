// Which season the navigation points at, from leagueInfo (see "Season phases" in the README)

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

// The main navigation, shared by the desktop header and the mobile bottom bar
export const navTabs = (leagueInfo) => [
  { key: 'this-season', label: 'This season', to: `/seasons/${currentSeason(leagueInfo)}` },
  { key: 'seasons', label: 'Seasons', to: '/seasons' },
  { key: 'history', label: 'History', to: '/history' },
];

const HISTORY_PATHS = ['/history', '/standings', '/head-to-head', '/records', '/keepers'];

// Which tab a page belongs to: 'home', 'this-season', 'seasons', 'history', 'league' or null
export const activeTab = (pathname, leagueInfo) => {
  if (pathname === '/') return 'home';
  if (pathname === `/seasons/${currentSeason(leagueInfo)}` || pathname.startsWith('/power-rankings')) return 'this-season';
  if (pathname.startsWith('/seasons')) return 'seasons';
  if (HISTORY_PATHS.some((p) => pathname.startsWith(p))) return 'history';
  if (pathname.startsWith('/league-info-mobile') || pathname.startsWith('/suggestions')) return 'league';
  return null;
};
