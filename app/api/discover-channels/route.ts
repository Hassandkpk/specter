import { NextRequest, NextResponse } from 'next/server';
import { getChannelFingerprint, searchSimilarChannels, getChannelVideoTitles } from '@/lib/youtube';
import { verifyChannelRelevance } from '@/lib/claude';
import { getUserFromToken } from '@/lib/usage';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { seedHandle } = await req.json();
    const ytApiKey = process.env.YOUTUBE_API_KEY!;
    const anthropicKey = process.env.ANTHROPIC_API_KEY!;

    const fingerprint = await getChannelFingerprint(ytApiKey, seedHandle);
    if (!fingerprint) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

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
