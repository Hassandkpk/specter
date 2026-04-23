import { NextRequest, NextResponse } from 'next/server';
import { getOwnChannelTopVideos } from '@/lib/youtube';
import { getUserFromToken } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { ownChannel } = await req.json();
    const videos = await getOwnChannelTopVideos(process.env.YOUTUBE_API_KEY!, ownChannel, 7);
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Channel scan failed' },
      { status: 500 }
    );
  }
}
