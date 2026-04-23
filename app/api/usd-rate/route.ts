import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const pkrRate = data.rates?.PKR;
    if (!pkrRate) throw new Error('Rate not found');
    return NextResponse.json({ rate: pkrRate });
  } catch {
    return NextResponse.json({ rate: 280 });
  }
}
