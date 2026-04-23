import { NextRequest, NextResponse } from 'next/server';
import { generateViralRepeat, generateOutlierRemix, generateMinimalTwist } from '@/lib/claude';
import type { VideoResult } from '@/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey, niche, outliers, ownVideos, numRemixes } = await req.json();

    // Run all Anthropic calls in parallel to stay under Vercel's timeout
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

    return NextResponse.json({ viralRepeats, outlierRemixes, minimalTwists });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
