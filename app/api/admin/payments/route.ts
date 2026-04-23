import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/usage';
import { getServiceClient } from '@/lib/supabase-server';

const ADMIN_EMAIL = 'rjhassanali555@gmail.com';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceClient();
    const { data } = await supabase
      .from('pending_payments')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({ payments: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
