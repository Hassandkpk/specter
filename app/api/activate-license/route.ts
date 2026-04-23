import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { getUserFromToken } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { licenseKey } = await req.json();
    if (!licenseKey?.trim()) {
      return NextResponse.json({ error: 'License key required' }, { status: 400 });
    }

    const productPermalink = process.env.GUMROAD_PRODUCT_PERMALINK;
    if (!productPermalink) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const gumRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_permalink: productPermalink,
        license_key: licenseKey.trim(),
      }),
    });

    const gumData = await gumRes.json();
    if (!gumData.success) {
      return NextResponse.json({ error: 'Invalid or already used license key' }, { status: 400 });
    }

    const supabase = getServiceClient();
    await supabase.from('profiles').update({
      plan: 'paid',
      gumroad_license_key: licenseKey.trim(),
    }).eq('id', user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 });
  }
}
