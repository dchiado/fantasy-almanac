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
const VIEW_FILES = new Set(VIEWS.map((view) => `${view}.json`));

export const handler = async (event) => {
  const leagueId = event.queryStringParameters?.leagueId;
  const startYear = parseInt(event.queryStringParameters?.startYear, 10);
  // The league's current season, which isn't archived until it's final (see lambdas/cache)
  const endYear = parseInt(event.queryStringParameters?.endYear, 10) || new Date().getFullYear();

  if (!leagueId || isNaN(startYear)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'leagueId and startYear are required as query params' })
    };
  }

  const yearsToCheck = [];
  for (let year = startYear; year < endYear; year++) {
    yearsToCheck.push(year);
  }

  let completedYears = 0;

  for (const year of yearsToCheck) {
    const prefix = `espn-cache/${leagueId}/${year}/`;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      // Skip weeks/ subfolders
      Delimiter: '/'
    });

    const response = await s3.send(command);
    // Count only view files, not markers like _finality.json
    const fileCount = (response.Contents || [])
      .filter(({ Key }) => VIEW_FILES.has(Key.slice(prefix.length)))
      .length;
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
