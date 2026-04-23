import Anthropic from '@anthropic-ai/sdk';

function extractText(message: Anthropic.Message): string {
  const block = message.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

export async function verifyChannelRelevance(
  apiKey: string,
  seedName: string,
  seedTitles: string[],
  candidateName: string,
  candidateTitles: string[]
): Promise<boolean> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5,
    messages: [{
      role: 'user',
      content: `Are these two YouTube channels in the same niche? Reply only "yes" or "no".

Channel A (${seedName}): ${seedTitles.slice(0, 5).join(' | ')}

Channel B (${candidateName}): ${candidateTitles.slice(0, 5).join(' | ')}`,
    }],
  });
  return extractText(msg).toLowerCase().startsWith('yes');
}

export async function generateNicheQueries(
  apiKey: string,
  channelName: string,
  description: string,
  keywords: string[],
  videoTitles: string[]
): Promise<string[]> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are a YouTube niche analyst. Based on the channel info below, generate 5 specific YouTube search queries to find similar niche channels (not huge generalist channels).

Channel: ${channelName}
Description: ${description.slice(0, 400)}
Keywords: ${keywords.slice(0, 10).join(', ')}
Recent titles:
${videoTitles.slice(0, 12).map(t => `- ${t}`).join('\n')}

Output ONLY a JSON array of 5 search query strings. No other text.`,
    }],
  });
  const text = extractText(msg);
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    const matches = text.match(/"([^"]+)"/g);
    return matches ? matches.map(m => m.replace(/"/g, '')).slice(0, 5) : [];
  }
}

export async function generateViralRepeat(apiKey: string, originalTitle: string, niche: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a YouTube title strategist for a ${niche} channel.

Here is one of our own viral video titles:
"${originalTitle}"

Your task: Rewrite this title with a completely FRESH angle and new storyline, but keep the EXACT same format and structure. Same emotional hooks, same title pattern, same length — but a totally new topic or angle that hasn't been covered yet.

Rules:
- Output ONLY the new title, nothing else
- No explanations, no preamble, no quotes around the title
- Keep the same structural formula
- Make it emotionally charged like the original`,
    }],
  });
  return extractText(msg);
}

export async function generateMinimalTwist(apiKey: string, originalTitle: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const maxLen = originalTitle.length;
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `You are a YouTube title optimizer. Make the smallest possible change to improve this title's click-through rate without changing its meaning, structure, or topic.

Original: "${originalTitle}"
Hard limit: ${maxLen} characters (must not exceed this)

Rules:
- Change at most 1-2 words only
- Swap weak words for power words (e.g. "good" → "insane", "tried" → "survived", "big" → "massive")
- Or add a number/stat if it fits naturally in place of a vague word
- Keep the exact same sentence structure and angle
- Output ONLY the new title, nothing else`,
    }],
  });
  return extractText(msg);
}

export async function generateOutlierRemix(
  apiKey: string,
  outlierTitle: string,
  niche: string,
  allOutlierTitles: string[]
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a YouTube title strategist for a ${niche} channel.

Here are the trending titles in this niche right now — study their FORMAT and FRAMEWORK patterns:
${allOutlierTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

The specific video to remix:
"${outlierTitle}"

Your task: Create a brand new title with a COMPLETELY DIFFERENT topic and angle, but written in one of the SAME FORMAT PATTERNS trending in this niche (e.g. "I did X for Y days", "Why I quit X", numbered lists, questions, shocking statements — whatever patterns you see above).

Rules:
- Output ONLY the new title, nothing else
- Must use a proven format pattern from the trending titles above
- Completely different topic from the original video
- Must feel native to this niche — not out of place
- No explanations, no preamble, no quotes`,
    }],
  });
  return extractText(msg);
}
