import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/usage';
import { getServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { transactionId, amountPkr } = await req.json();
    if (!transactionId?.trim()) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: existing } = await supabase
      .from('pending_payments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending payment. Please wait for approval.' },
        { status: 400 }
      );
    }

    await supabase.from('pending_payments').insert({
      user_id: user.id,
      user_email: user.email,
      transaction_id: transactionId.trim(),
      amount_pkr: amountPkr,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}
