import Anthropic from '@anthropic-ai/sdk';

function extractText(message: Anthropic.Message): string {
  const block = message.content[0];
  return block.type === 'text' ? block.text.trim() : '';
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

export async function generateOutlierRemix(apiKey: string, outlierTitle: string, niche: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a YouTube title strategist for a ${niche} channel.

A competitor's video is going viral with this title:
"${outlierTitle}"

Your task: Generate a BRAND NEW YouTube title inspired by the same emotional angle and viral hook, but with a completely different storyline or framing. Keep the same emotional energy — if the original is shocking or controversial, yours should be too. Do NOT copy or rephrase — create something entirely new that captures the same energy.

Rules:
- Output ONLY the new title, nothing else
- No explanations, no preamble, no quotes around the title
- Make it dramatic or emotionally charged
- It must feel original, not like a direct copy of the competitor's topic`,
    }],
  });
  return extractText(msg);
}
