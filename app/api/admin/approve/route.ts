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

    const { paymentId, action } = await req.json();
    const supabase = getServiceClient();

    const { data: payment } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await supabase
      .from('pending_payments')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (action === 'approve') {
      await supabase
        .from('profiles')
        .update({ plan: 'paid' })
        .eq('id', payment.user_id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
