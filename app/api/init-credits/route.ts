import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, initializeCredits } from '@/lib/usage';
import { getServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0';
    await initializeCredits(user.id, ip);

    const supabase = getServiceClient();
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
  }
}
