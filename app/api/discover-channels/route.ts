import { NextRequest, NextResponse } from 'next/server';
import { getChannelFingerprint, searchSimilarChannels } from '@/lib/youtube';
import { generateNicheQueries } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const { ytApiKey, anthropicKey, seedHandle } = await req.json();

    const fingerprint = await getChannelFingerprint(ytApiKey, seedHandle);
    if (!fingerprint) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const queries = await generateNicheQueries(
      anthropicKey,
      fingerprint.channelName,
      fingerprint.description,
      fingerprint.keywords,
      fingerprint.videoTitles
    );

    if (!queries.length) {
      return NextResponse.json({ error: 'Could not generate search queries' }, { status: 500 });
    }

    const channels = await searchSimilarChannels(ytApiKey, queries, fingerprint.channelId);

    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    );
  }
}
