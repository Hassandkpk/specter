import { NextRequest, NextResponse } from 'next/server';
import { scanKeyword, scanCompetitors } from '@/lib/youtube';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, remaining } = await checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        { error: 'You\'ve used all 10 daily searches. Come back tomorrow.' },
        { status: 429 }
      );
    }

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

    return NextResponse.json({ outliers, remaining });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
