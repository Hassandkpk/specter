import { NextRequest, NextResponse } from 'next/server';
import { generateViralRepeat, generateOutlierRemix, generateMinimalTwist } from '@/lib/claude';
import { getUserFromToken, initializeCredits, deductCredits, calcGenerateCost } from '@/lib/usage';
import type { VideoResult } from '@/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0';
    await initializeCredits(user.id, ip);

    const { niche, outliers, ownVideos, numRemixes } = await req.json();

    const cost = calcGenerateCost(numRemixes, (ownVideos as VideoResult[]).length);
    const { allowed, remaining } = await deductCredits(user.id, cost);
    if (!allowed) {
      return NextResponse.json(
        { error: `Not enough credits. This run costs ${cost} credits but you only have ${remaining}.` },
        { status: 402 }
      );
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY!;

    const [viralRepeats, outlierRemixes, minimalTwists] = await Promise.all([
      Promise.all(
        (ownVideos as VideoResult[]).map(async video => ({
          originalTitle: video.title,
          generatedTitle: await generateViralRepeat(anthropicKey, video.title, niche),
          link: video.link,
          views: video.views,
          type: 'viral_repeat' as const,
        }))
      ),
      Promise.all(
        (outliers as VideoResult[]).slice(0, numRemixes).map(async video => ({
          originalTitle: video.title,
          generatedTitle: await generateOutlierRemix(
            anthropicKey,
            video.title,
            niche,
            (outliers as VideoResult[]).map(v => v.title)
          ),
          link: video.link,
          views: video.views,
          velocity: video.velocity,
          type: 'outlier_remix' as const,
        }))
      ),
      Promise.all(
        (outliers as VideoResult[]).map(async video => ({
          originalTitle: video.title,
          generatedTitle: await generateMinimalTwist(anthropicKey, video.title),
          link: video.link,
          views: video.views,
          velocity: video.velocity,
          type: 'minimal_twist' as const,
        }))
      ),
    ]);

    return NextResponse.json({ viralRepeats, outlierRemixes, minimalTwists, creditsRemaining: remaining });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
