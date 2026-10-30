import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const s3 = new S3Client({ region: "us-east-2" });
const ssm = new SSMClient({ region: "us-east-2" });
const BUCKET = 'ffalmanac-data';

let _apiKey;
async function getApiKey() {
  if (_apiKey) return _apiKey;
  const res = await ssm.send(new GetParameterCommand({
    Name: '/ffalmanac/ANTHROPIC_API_KEY',
    WithDecryption: true,
  }));
  _apiKey = res.Parameter.Value;
  return _apiKey;
}

const prefix = ({ year, week, league_id }) => `power_rankings/league_${league_id}/${year}/week_${week}`;

// What the prompt knows about each league in AI_LEAGUES: a name for the title
// and its background. Other leagues get neither.
const LEAGUES = {
  '166975': {
    name: 'Gridiron',
    context: `- League context. Don't overdo it with these, but just for reference:
  * This league has been around for 20 years
  * It is old friends from high school that are now mid 30s guys that live all over the country
  * There is a rule that if someone loses by 50, they have to shotgun a beer. If you do reference this, be subtle and don't overdo it.`,
  },
  '1637874931': {
    context: `- League context. Don't overdo it with these, but just for reference:
  * The league is coworkers at a SaaS company
  * Generic office and SaaS jokes are fine (churn, roadmaps, standups), but don't overdo it
  * Keep the trash talk about fantasy teams, lineups and results. Nothing about anyone's actual job, performance at work, personal life or appearance.`,
  },
};

// Marks the week's writeup as failed, so powerRankings stops showing it as
// pending and never retries it (every retry would be another Claude call)
async function markFailed(event) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${prefix(event)}/status.json`,
      Body: JSON.stringify({ status: 'failed' }),
      ContentType: 'application/json',
    }));
  } catch (error) {
    console.error('Error writing failed marker:', error);
  }
}

export const handler = async (event) => {
  try {
    return await writeRankings(event);
  } catch (error) {
    console.error('Writeup failed:', error);
    await markFailed(event);
  }
};

async function writeRankings(data) {
  const apiKey = await getApiKey();
  console.log('Got data: ');
  console.log(data);

  const league = LEAGUES[data.league_id] ?? {};
  const title = league.name ? `Week <week> ${league.name} Power Rankings` : 'Week <week> Power Rankings';

  const winBonusRule = data.has_win_bonus
    ? `  * This league has a weekly bonus: each team also gets a win for scoring in the top half of the league that week, and a loss otherwise. A team's record includes those, so always use "wins" for its record. Don't work out a record from "games" or "matchups".
`
    : '';

  const prompt = `
You are a fantasy sports analyst writing weekly power rankings for a fantasy league. 
Use the following dataset of teams (wins, recent form, points, booms/busts, consistency, matchups).

Instructions:
- Ranked list: The teams are already sorted from best to worst. Do NOT change the order.
- Format: Use a "${title}" at the top. Put the team names as headings. Bold key stats.
- Tone: Funny, snarky, conversational, not too cheesy. Poke fun at teams and players where appropriate. Reference current sports events or pop culture if relevant.
- Content: For each team, write 3–4 sentences summarizing:
  * Overall performance and record
  * Recent streaks or slumps
  * Strengths, weaknesses, and quirks
  * Highlight recent big wins, embarrassing losses, trends, or "oops" moments
  * Don't lean too hard into one stat (booms & busts, consistency, etc)
- Rules:
  * Don't mention standard deviations, the actually consistency number value, or other overly-statistical details in the writeup
  * If you mention booms and busts, explain what that is. Boom is a 140+ week, and bust is a <90 week.
${winBonusRule}${league.context ?? ''}
- Stat definitions:
  "scores": their weekly scores
  "against": the weekly scores against them
  "games": whether they won or lost their head-to-head matchup each week
  "matchups": details about their matchups each week
  "wins": total wins, including any weekly bonus wins
  "losses": total losses, including any weekly bonus losses
  "h2h_wins": wins in head-to-head matchups
  "bonus_wins": weekly bonus wins
  "wins_last_5": head-to-head wins in the last 5 matchups
  "points": total points
  "avg_score": average weekly score
  "avg_against": average weekly score against them
  "overall_wins": total wins if everyone played everyone each week
  "consistency": standard deviation of weekly scores
  "booms": number of booms (>140 pts)
  "busts": number of busts (<90 pts)
  "median_wins": wins against each weeks median score

Dataset:
${JSON.stringify(data)}
`;

  console.log('Prompt: ');
  console.log(prompt);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        { role: "user", content: prompt }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  }

  const resp = await response.json();
  console.log(resp);

  const llm_response = resp.content[0].text;
  console.log('LLM response: ');
  console.log(llm_response);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${prefix(data)}/rankings.md`,
    Body: llm_response,
    ContentType: 'text/markdown'
  }));

  return {
    statusCode: 200,
    body: llm_response,
  };
}
