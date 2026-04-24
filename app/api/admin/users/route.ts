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

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 200 });
    const authUsers = authData?.users ?? [];

    const { data: profiles } = await supabase.from('profiles').select('id, plan, banned');
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const users = authUsers.map(u => ({
      id: u.id,
      email: u.email ?? '',
      plan: profileMap.get(u.id)?.plan ?? 'free',
      banned: profileMap.get(u.id)?.banned ?? false,
      created_at: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
