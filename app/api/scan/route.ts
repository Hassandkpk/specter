import { NextRequest, NextResponse } from 'next/server';
import { scanKeyword, scanCompetitors } from '@/lib/youtube';
import { getUserFromToken, checkAndIncrementUsage } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { allowed, reason, profile } = await checkAndIncrementUsage(user.id);
    if (!allowed) return NextResponse.json({ error: reason }, { status: 429 });

    const { niche, competitors } = await req.json();
    const ytApiKey = process.env.YOUTUBE_API_KEY!;

    const [keywordResults, compResults] = await Promise.all([
      scanKeyword(ytApiKey, niche, 25),
      scanCompetitors(ytApiKey, competitors, 10),
    ]);

    const all = [...keywordResults.slice(0, 10), ...compResults];
    const outliers = all
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, 10);

    return NextResponse.json({ outliers, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
