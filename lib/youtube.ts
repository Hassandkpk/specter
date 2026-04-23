import { google, youtube_v3 } from 'googleapis';
import type { VideoResult, Competitor, DiscoveredChannel } from '@/types';

function getClient(apiKey: string) {
  return google.youtube({ version: 'v3', auth: apiKey });
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || '0') * 3600 +
    parseInt(match[2] || '0') * 60 +
    parseInt(match[3] || '0')
  );
}

function calcVelocity(video: youtube_v3.Schema$Video) {
  const views = parseInt(video.statistics?.viewCount || '0');
  const publishedAt = video.snippet?.publishedAt || '';
  const hours = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
  return {
    views,
    hoursSinceUpload: Math.round(hours * 100) / 100,
    velocity: Math.floor(views / hours),
  };
}

function filterLong(videos: youtube_v3.Schema$Video[], minSec = 70) {
  return videos.filter(
    v => parseDurationSeconds(v.contentDetails?.duration || 'PT0S') > minSec
  );
}

async function getSubCounts(yt: youtube_v3.Youtube, ids: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(ids)];
  const map: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 50) {
    try {
      const res = await yt.channels.list({
        part: ['statistics'],
        id: unique.slice(i, i + 50),
      });
      for (const item of res.data.items || []) {
        map[item.id!] = parseInt(item.statistics?.subscriberCount || '0');
      }
    } catch {}
  }
  return map;
}

async function resolveHandle(yt: youtube_v3.Youtube, input: string): Promise<string | null> {
  const trimmed = input.trim();

  // Direct channel ID (UC...)
  if (/^UC[\w-]{20,}$/.test(trimmed)) return trimmed;

  // Extract from YouTube URLs
  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) return channelIdMatch[1];

  let slug = trimmed;
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  const customMatch = trimmed.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/);
  if (handleMatch) slug = handleMatch[1];
  else if (customMatch) slug = customMatch[1];
  else slug = trimmed.replace('@', '');

  try {
    const res = await yt.channels.list({ part: ['id'], forHandle: slug });
    if (res.data.items?.[0]) return res.data.items[0].id!;
  } catch {}
  try {
    const res = await yt.search.list({ q: slug, part: ['snippet'], type: ['channel'], maxResults: 5 });
    if (res.data.items?.[0]) return res.data.items[0].snippet?.channelId || null;
  } catch {}
  return null;
}

async function getUploadsPlaylist(yt: youtube_v3.Youtube, channelId: string): Promise<string | null> {
  try {
    const res = await yt.channels.list({ part: ['contentDetails'], id: [channelId] });
    return res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  } catch { return null; }
}

async function getRecentVideos(yt: youtube_v3.Youtube, channelId: string, max = 10): Promise<youtube_v3.Schema$Video[]> {
  const playlistId = await getUploadsPlaylist(yt, channelId);
  if (!playlistId) return [];
  try {
    const pRes = await yt.playlistItems.list({ part: ['snippet'], playlistId, maxResults: max });
    const ids = (pRes.data.items || [])
      .map(i => i.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[];
    if (!ids.length) return [];
    const vRes = await yt.videos.list({ part: ['snippet', 'statistics', 'contentDetails'], id: ids });
    return vRes.data.items || [];
  } catch { return []; }
}

// ── Discovery helpers ─────────────────────────────────────────────────────────

export async function getChannelFingerprint(apiKey: string, handle: string): Promise<{
  channelId: string;
  channelName: string;
  description: string;
  keywords: string[];
  videoTitles: string[];
} | null> {
  const yt = getClient(apiKey);
  const channelId = await resolveHandle(yt, handle);
  if (!channelId) return null;

  const [chanRes, recentVideos] = await Promise.all([
    yt.channels.list({ part: ['snippet', 'brandingSettings'], id: [channelId] }),
    getRecentVideos(yt, channelId, 20),
  ]);

  const chan = chanRes.data.items?.[0];
  if (!chan) return null;

  return {
    channelId,
    channelName: chan.snippet?.title || '',
    description: chan.snippet?.description || '',
    keywords: (chan.brandingSettings?.channel?.keywords || '').split(/[\s,]+/).filter(Boolean),
    videoTitles: recentVideos.map(v => v.snippet?.title || '').filter(Boolean),
  };
}

export async function searchSimilarChannels(
  apiKey: string,
  videoTitles: string[],
  excludeId: string
): Promise<DiscoveredChannel[]> {
  const yt = getClient(apiKey);

  // Search for videos using the seed channel's own titles as queries.
  // Channels that appear across multiple searches are niche peers.
  const frequency = new Map<string, number>();
  for (const title of videoTitles.slice(0, 7)) {
    try {
      const res = await yt.search.list({
        q: title, part: ['snippet'], type: ['video'], maxResults: 10, order: 'relevance',
      });
      for (const item of res.data.items || []) {
        const cid = item.snippet?.channelId;
        if (cid && cid !== excludeId) frequency.set(cid, (frequency.get(cid) || 0) + 1);
      }
    } catch {}
  }

  if (!frequency.size) return [];

  // Take the most frequently appearing channel IDs first
  const ranked = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 30);

  const statsRes = await yt.channels.list({
    part: ['snippet', 'statistics'],
    id: ranked,
  });

  return (statsRes.data.items || [])
    .filter(item => parseInt(item.statistics?.subscriberCount || '0') < 10_000_000)
    .sort((a, b) => (frequency.get(b.id!) || 0) - (frequency.get(a.id!) || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.snippet?.title || '',
      handle: item.snippet?.customUrl
        ? (item.snippet.customUrl.startsWith('@') ? item.snippet.customUrl : `@${item.snippet.customUrl}`)
        : `@${item.id}`,
      channelId: item.id!,
      subscribers: parseInt(item.statistics?.subscriberCount || '0'),
      avatar: item.snippet?.thumbnails?.default?.url || '',
    }));
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function scanKeyword(apiKey: string, keyword: string, maxResults = 25): Promise<VideoResult[]> {
  const yt = getClient(apiKey);
  const sRes = await yt.search.list({ q: keyword, part: ['snippet'], type: ['video'], order: 'date', maxResults });
  const ids = (sRes.data.items || []).map(i => i.id?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];

  const vRes = await yt.videos.list({ part: ['snippet', 'statistics', 'contentDetails'], id: ids });
  const videos = filterLong(vRes.data.items || []);
  const subMap = await getSubCounts(yt, videos.map(v => v.snippet?.channelId ?? '').filter(Boolean));

  return videos.map(v => {
    const { views, hoursSinceUpload, velocity } = calcVelocity(v);
    const channelId = v.snippet?.channelId!;
    return {
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      channelId,
      views, hoursSinceUpload, velocity,
      subscribers: subMap[channelId] || 0,
      link: `https://www.youtube.com/watch?v=${v.id}`,
      sourceType: 'keyword' as const,
      keyword,
    };
  }).sort((a, b) => b.velocity - a.velocity);
}

export async function scanCompetitors(apiKey: string, competitors: Competitor[], maxPerChannel = 10): Promise<VideoResult[]> {
  const yt = getClient(apiKey);
  const rows: VideoResult[] = [];

  for (const comp of competitors) {
    try {
      const channelId = await resolveHandle(yt, comp.handle);
      if (!channelId) continue;

      const videos = filterLong(await getRecentVideos(yt, channelId, maxPerChannel));
      const subMap = await getSubCounts(yt, [channelId]);

      for (const v of videos) {
        const { views, hoursSinceUpload, velocity } = calcVelocity(v);
        rows.push({
          title: v.snippet?.title || '',
          channel: v.snippet?.channelTitle || '',
          channelId,
          views, hoursSinceUpload, velocity,
          subscribers: subMap[channelId] || 0,
          link: `https://www.youtube.com/watch?v=${v.id}`,
          sourceType: 'competitor' as const,
          competitor: comp.name,
        });
      }
    } catch { continue; }
  }

  return rows.sort((a, b) => b.velocity - a.velocity);
}

export async function getOwnChannelTopVideos(apiKey: string, handle: string, days = 7): Promise<VideoResult[]> {
  const yt = getClient(apiKey);
  const channelId = await resolveHandle(yt, handle);
  if (!channelId) return [];

  const videos = filterLong(await getRecentVideos(yt, channelId, 50));
  const cutoff = Date.now() - days * 24 * 3_600_000;
  const recent = videos.filter(v => new Date(v.snippet?.publishedAt || 0).getTime() >= cutoff);

  const subMap = await getSubCounts(yt, [channelId]);

  return recent.map(v => {
    const { views, hoursSinceUpload, velocity } = calcVelocity(v);
    return {
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      channelId,
      views, hoursSinceUpload, velocity,
      subscribers: subMap[channelId] || 0,
      link: `https://www.youtube.com/watch?v=${v.id}`,
      sourceType: 'keyword' as const,
    };
  }).sort((a, b) => b.views - a.views).slice(0, 3);
}
