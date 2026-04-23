import { NextRequest, NextResponse } from 'next/server';
import { getChannelFingerprint, searchSimilarChannels } from '@/lib/youtube';

export async function POST(req: NextRequest) {
  try {
    const { ytApiKey, seedHandle } = await req.json();

    const fingerprint = await getChannelFingerprint(ytApiKey, seedHandle);
    if (!fingerprint) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (!fingerprint.videoTitles.length) {
      return NextResponse.json({ error: 'Channel has no recent videos to search from' }, { status: 400 });
    }

    const channels = await searchSimilarChannels(ytApiKey, fingerprint.videoTitles, fingerprint.channelId);

    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    );
  }
}
