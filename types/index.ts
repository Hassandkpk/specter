export interface Competitor {
  name: string;
  handle: string;
}

export interface VideoResult {
  title: string;
  channel: string;
  channelId: string;
  views: number;
  hoursSinceUpload: number;
  velocity: number;
  subscribers: number;
  link: string;
  sourceType: 'keyword' | 'competitor';
  keyword?: string;
  competitor?: string;
}

export interface DiscoveredChannel {
  name: string;
  handle: string;
  channelId: string;
  subscribers: number;
  avatar: string;
}

export interface GeneratedResult {
  originalTitle: string;
  generatedTitle: string;
  link: string;
  views: number;
  velocity?: number;
  type: 'viral_repeat' | 'outlier_remix' | 'minimal_twist';
}
