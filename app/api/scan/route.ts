import { NextRequest, NextResponse } from 'next/server';
import { scanKeyword, scanCompetitors } from '@/lib/youtube';

export async function POST(req: NextRequest) {
  try {
    const { ytApiKey, niche, competitors } = await req.json();

    const [keywordResults, compResults] = await Promise.all([
      scanKeyword(ytApiKey, niche, 25),
      scanCompetitors(ytApiKey, competitors, 10),
    ]);

    const all = [...keywordResults.slice(0, 10), ...compResults];
    const outliers = all
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, 10);

    return NextResponse.json({ outliers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
