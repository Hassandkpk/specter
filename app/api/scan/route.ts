import { NextRequest, NextResponse } from 'next/server';
import { scanKeyword, scanCompetitors } from '@/lib/youtube';
import { getUserFromToken, initializeCredits } from '@/lib/usage';
import { getServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('banned')
      .eq('id', user.id)
      .single();
    if (profileCheck?.banned) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0';
    await initializeCredits(user.id, ip);

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

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    return NextResponse.json({ outliers, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
