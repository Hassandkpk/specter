import { NextRequest, NextResponse } from 'next/server';
import { getChannelFingerprint, searchSimilarChannels, getChannelVideoTitles } from '@/lib/youtube';
import { verifyChannelRelevance } from '@/lib/claude';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { ytApiKey, anthropicKey, seedHandle } = await req.json();

    const fingerprint = await getChannelFingerprint(ytApiKey, seedHandle);
    if (!fingerprint) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Tags are more niche-specific than titles — fall back to titles if tags are sparse
    const searchTerms = fingerprint.topTags.length >= 3
      ? fingerprint.topTags
      : fingerprint.videoTitles;

    if (!searchTerms.length) {
      return NextResponse.json({ error: 'Channel has no content to search from' }, { status: 400 });
    }

    const candidates = await searchSimilarChannels(ytApiKey, searchTerms, fingerprint.channelId);
    if (!candidates.length) {
      return NextResponse.json({ channels: [] });
    }

    // Verify each candidate in parallel — fetch their titles then ask Claude
    const results = await Promise.all(
      candidates.map(async ch => {
        try {
          const titles = await getChannelVideoTitles(ytApiKey, ch.channelId, 5);
          const relevant = await verifyChannelRelevance(
            anthropicKey,
            fingerprint.channelName,
            fingerprint.videoTitles,
            ch.name,
            titles
          );
          return relevant ? ch : null;
        } catch {
          return null;
        }
      })
    );

    const channels = results.filter(Boolean).slice(0, 5);
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    );
  }
}
