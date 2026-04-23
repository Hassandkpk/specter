import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const email = params.get('email');
    const licenseKey = params.get('license_key');
    const refunded = params.get('refunded') === 'true';

    if (!email || !licenseKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      await supabase.from('profiles').update({
        plan: refunded ? 'free' : 'paid',
        gumroad_license_key: refunded ? null : licenseKey,
      }).eq('id', user.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
