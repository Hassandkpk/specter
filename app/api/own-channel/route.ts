import { NextRequest, NextResponse } from 'next/server';
import { getOwnChannelTopVideos } from '@/lib/youtube';

export async function POST(req: NextRequest) {
  try {
    const { ytApiKey, ownChannel } = await req.json();
    const videos = await getOwnChannelTopVideos(ytApiKey, ownChannel, 7);
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Channel scan failed' },
      { status: 500 }
    );
  }
}
