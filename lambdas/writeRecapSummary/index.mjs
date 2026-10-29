// Writes the few sentences at the top of a weekly recap. Invoked asynchronously
// by the season lambda with the recap's facts (engine/recap_summary.py) and
// where to store the text; see "Claude costs" in the README.
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const s3 = new S3Client({ region: "us-east-2" });
const ssm = new SSMClient({ region: "us-east-2" });
const BUCKET = 'ffalmanac-data';

const MAX_WORDS = 150;

const SYSTEM = `You're the league's resident wiseguy writing this week's fantasy football \
recap: the thing people read out loud in the group chat. Everyone in the league knows each \
other, and giving each other a hard time is half the fun of fantasy football.

You get a list of facts about the week. Write one paragraph that runs through every game, \
briefly: usually one sentence per game, two only when there's a real story. Start with the \
week's best story, the thing everyone will be talking about (a manager who benched the points \
that would have won, a score that lost anyway, a lucky win, a monster week, a collapse in \
playoff odds, the championship), then work through the rest. Say who won, and when there's \
something to it, what made it interesting: a top scorer who carried them, a bench blunder, \
luck, what it did to playoff odds. A boring game gets a quick mention and nothing more.

Voice:
- Call managers exactly what the facts call them. Never use team names.
- Don't guess anyone's pronouns from their name: repeat the name or use "they".
- Tease the manager, not the player. Good-natured trash talk, never mean about anything outside \
fantasy football.
- Round to whole numbers ("155", not "155.32"), and don't put a number in every sentence.
- Short, punchy sentences that vary in shape. Like texts from a friend, not a sports broadcast \
or a report.

Example of the tone, about a made-up league. Don't reuse its wording:
"Mike left 38 points on the bench in a 99 to 103 loss to Jess. Bold strategy. Jess, for the \
record, scored the 2nd-lowest total of the week and will tell you it was all part of the plan. \
Pat put up 171, the 4th-best score in league history, and Sam never stood a chance. Chris beat \
Alex by 2 in a game nobody will remember, and Robin's 140 was too much for Lee."

Rules:
- One paragraph, at most ${MAX_WORDS} words. Mention every game.
- Every name and number must come from the facts. Don't work out new numbers, like a difference \
or a total, and don't invent anything about players, teams or people.
- Plain text only: no markdown, headings, emoji, hashtags, or quotation marks around the whole thing.`;

let _client;
async function client() {
  if (_client) {
    return _client;
  }

  const res = await ssm.send(new GetParameterCommand({
    Name: '/ffalmanac/ANTHROPIC_API_KEY',
    WithDecryption: true,
  }));
  _client = new Anthropic({ apiKey: res.Parameter.Value, maxRetries: 0 });
  return _client;
}

// Every number in the text, as written: "171.2", "4", "74"
const numbers = (text) => text.match(/\d+(?:\.\d+)?/g) ?? [];

// A number the summary may use: one in the facts, or a fact's number rounded
// to a whole one ("171" for 171.2)
export const unknownNumbers = (summary, facts) => {
  const known = new Set();
  for (const n of numbers(facts.join('\n'))) {
    known.add(Number(n));
    known.add(Math.round(Number(n)));
    known.add(Math.trunc(Number(n)));
  }

  return numbers(summary).filter((n) => !known.has(Number(n)));
};

async function put(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

// Marks the summary as failed, so the season lambda stops showing it as
// pending and never retries it (every retry would be another Claude call)
async function markFailed(statusKey) {
  try {
    await put(statusKey, JSON.stringify({ status: 'failed' }), 'application/json');
  } catch (error) {
    console.error('Error writing failed marker:', error);
  }
}

async function writeSummary({ facts, text_key: textKey }) {
  const anthropic = await client();
  const response = await anthropic.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Facts:\n${facts.map((f) => `- ${f}`).join('\n')}` }],
  });

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`Claude stopped with ${response.stop_reason}`);
  }

  const summary = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  console.log('Summary:', summary);

  // Missing beats wrong: a number that isn't in the facts was made up or misread
  const unknown = unknownNumbers(summary, facts);
  if (unknown.length > 0) {
    throw new Error(`Numbers not in the facts: ${unknown.join(', ')}`);
  }

  const words = summary.split(/\s+/).length;
  if (!summary || words > MAX_WORDS * 1.5) {
    throw new Error(`Summary is ${words} words`);
  }

  await put(textKey, summary, 'text/plain; charset=utf-8');
}

export const handler = async (event) => {
  try {
    await writeSummary(event);
  } catch (error) {
    console.error('Summary failed:', error);
    await markFailed(event.status_key);
  }
};
