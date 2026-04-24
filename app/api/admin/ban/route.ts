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

    const { userId, banned } = await req.json();
    if (!userId || typeof banned !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { error } = await supabase
      .from('profiles')
      .update({ banned })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update ban status' }, { status: 500 });
  }
}
