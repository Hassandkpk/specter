import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/usage';
import { getServiceClient } from '@/lib/supabase-server';

const ADMIN_EMAIL = 'rjhassanali555@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, credits } = await req.json();
    if (typeof credits !== 'number' || credits < 0) {
      return NextResponse.json({ error: 'Invalid credits value' }, { status: 400 });
    }

    const supabase = getServiceClient();
    await supabase.from('profiles').update({ credits }).eq('id', userId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to set credits' }, { status: 500 });
  }
}
