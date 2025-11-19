import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-2" });
const BUCKET = 'ffalmanac-data';

export const handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const data = event;
  console.log('Got data: ');
  console.log(data);
  const { year, week, league_id } = data;

  const prompt = `
You are a fantasy sports analyst writing weekly power rankings for a fantasy league. 
Use the following dataset of teams (wins, recent form, points, booms/busts, consistency, matchups).

Instructions:
- Ranked list: The teams are already sorted from best to worst. Do NOT change the order.
- Format: Use a "Week <week> Gridiron Power Rankings" at the top. Put the team names as headings. Bold key stats.
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
- League context. Don't overdo it with these, but just for reference:
  * This league has been around for 20 years
  * It is old friends from high school that are now mid 30s guys that live all over the country
  * There is a rule that if someone loses by 50, they have to shotgun a beer. If you do reference this, be subtle and don't overdo it.
- Stat definitions:
  "scores": their weekly scores
  "against": the weekly scores against them
  "games": whether they won or lost each week
  "matchups": details about their matchups each week
  "wins": total wins
  "wins_last_5": wins in the last 5 matchups
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
    console.error('Claude API error', response.status, await response.text());
    return;
  }  

  const resp = await response.json();
  console.log(resp);

  const llm_response = resp.content[0].text;
  console.log('LLM response: ');
  console.log(llm_response);

  // Create a unique S3 key
  const key = `power_rankings/league_${league_id}/${year}/week_${week}/rankings.md`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: llm_response,
      ContentType: 'text/markdown'
    });

    await s3.send(command);
  } catch (error) {
    console.error('Error writing to S3:', error);
  }

  return {
    statusCode: 200,
    body: llm_response,
  };
};
