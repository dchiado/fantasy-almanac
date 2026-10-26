import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-2" });
const BUCKET = 'ffalmanac-data';

const VIEWS = [
  'kona_game_state',
  'kona_league_communication',
  'kona_player_info',
  'mDraftDetail',
  'mLiveScoring',
  'mMatchup',
  'mMatchupScore',
  'mNav',
  'mPositionalRatings',
  'mPositionalRatingsStats',
  'mRoster',
  'mScoreboard',
  'mSettings',
  'mStatus',
  'mTeam',
  'mTransactions2',
  'players_wl'
];

const espnUrl = (leagueId, year, view) => year > 2019
  ? `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=${view}`
  : `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=${view}`;

// The league's current season per ESPN. ESPN returns GENERAL_NOT_FOUND for the
// new calendar year until the league rolls over, so fall back a year.
const currentSeason = async (leagueId, headers) => {
  const thisYear = new Date().getFullYear();
  for (const year of [thisYear, thisYear - 1]) {
    const res = await fetch(espnUrl(leagueId, year, 'mStatus'), { headers });
    if (res.ok) return (await res.json()).seasonId;
  }
  return null;
};

export const handler = async (event) => {
  const { espn_s2, startYear } = JSON.parse(event.body || '{}');
  const { leagueId } = event.queryStringParameters || {};

  if (!leagueId || !espn_s2 || !startYear) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'leagueId, startYear, and espn_s2 are required' })
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Cookie': `espn_s2=${espn_s2}`
  };

  // Only seasons before the current one are final, so only those are archived.
  // The current season is archived by the Python lambdas once it's final.
  const season = await currentSeason(leagueId, headers);
  if (!season) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Couldn't find the league's current season on ESPN" })
    };
  }

  const results = [];

  for (let year = startYear; year < season; year++) {
    for (const view of VIEWS) {
      const url = espnUrl(leagueId, year, view);
      const key = `espn-cache/${leagueId}/${year}/${view}.json`;
  
      try {
        const res = await fetch(url, { headers });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.text();
  
        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: data,
          ContentType: 'application/json'
        });

        await s3.send(command);

        console.log(`Saved ${key}`);
        results.push({ year, view, status: 'success' });
      } catch (err) {
        console.warn(`Failed for ${year} / ${view}`, err.message);
        results.push({ year, view, status: 'error', message: err.message });
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Completed', results })
  };
};
