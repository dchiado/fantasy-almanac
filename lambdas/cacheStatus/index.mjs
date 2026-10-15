import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
const TOTAL_VIEWS = VIEWS.length;

export const handler = async (event) => {
  const leagueId = event.queryStringParameters?.leagueId;
  const startYear = parseInt(event.queryStringParameters?.startYear, 10);

  if (!leagueId || isNaN(startYear)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'leagueId and startYear are required as query params' })
    };
  }

  const currentYear = new Date().getFullYear();
  const yearsToCheck = [];
  for (let year = startYear; year < currentYear; year++) {
    yearsToCheck.push(year);
  }

  let completedYears = 0;

  for (const year of yearsToCheck) {
    const prefix = `espn-cache/${leagueId}/${year}/`;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix
    });

    const response = await s3.send(command);
    const fileCount = response.Contents?.length || 0;
    console.log('year: ', year, ', fileCount: ', fileCount);

    if (fileCount >= TOTAL_VIEWS) {
      completedYears++;
    }
  }

  const percentComplete = Math.round((completedYears / yearsToCheck.length) * 100);
  const done = completedYears === yearsToCheck.length;

  return {
    statusCode: 200,
    body: JSON.stringify({
      percentComplete,
      done,
      message: done
        ? `All years (${completedYears}) completed`
        : `Working on it: ${completedYears} of ${yearsToCheck.length} years done...`
    })
  };
};
