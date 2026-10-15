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

export const handler = async (event) => {
  console.log('Event', event);
  console.log('event.body', event.body);
  console.log('JSON.parse(event.body)', JSON.parse(event.body));
  const { espn_s2, startYear } = JSON.parse(event.body || '{}');
  const { leagueId } = event.queryStringParameters || {};

  if (!leagueId || !espn_s2 || !startYear) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'leagueId, startYear, and espn_s2 are required' })
    };
  }

  const currentYear = new Date().getFullYear();
  const results = [];

  for (let year = startYear; year < currentYear; year++) {
    for (const view of VIEWS) {
      let url;
      if (year > 2019) {
        url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=${view}`
      } else {
        url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=${view}`;
      }
      const key = `espn-cache/${leagueId}/${year}/${view}.json`;
  
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Cookie': `espn_s2=${espn_s2}`
          }
        });

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
