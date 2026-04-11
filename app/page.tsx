'use client';

import { useState } from 'react';
import type { VideoResult, GeneratedResult } from '@/types';

function getVideoId(link: string) {
  return link.split('v=')[1]?.split('&')[0] || '';
}

function thumbUrl(link: string) {
  const id = getVideoId(link);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type Step = 'idle' | 'scanning' | 'own-channel' | 'generating' | 'done';

export default function Home() {
  // form
  const [ytKey, setYtKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [niche, setNiche] = useState('');
  const [ownChannel, setOwnChannel] = useState('');
  const [competitors, setCompetitors] = useState(['', '', '', '', '']);
  const [numRemixes, setNumRemixes] = useState(10);

  // results
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [outliers, setOutliers] = useState<VideoResult[]>([]);
  const [ownVideos, setOwnVideos] = useState<VideoResult[]>([]);
  const [viralRepeats, setViralRepeats] = useState<GeneratedResult[]>([]);
  const [outlierRemixes, setOutlierRemixes] = useState<GeneratedResult[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const isReady = ytKey && anthropicKey && niche && competitors.some(c => c.trim());
  const isRunning = step !== 'idle' && step !== 'done';

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const run = async () => {
    setError('');
    setOutliers([]);
    setOwnVideos([]);
    setViralRepeats([]);
    setOutlierRemixes([]);

    const validCompetitors = competitors
      .filter(c => c.trim())
      .map(h => ({ name: h.trim().replace('@', ''), handle: h.trim() }));

    // Step 1: Scan
    setStep('scanning');
    let scannedOutliers: VideoResult[] = [];
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ytApiKey: ytKey, niche, competitors: validCompetitors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      scannedOutliers = data.outliers;
      setOutliers(scannedOutliers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStep('idle');
      return;
    }

    // Step 2: Own channel (optional)
    let ownChannelVideos: VideoResult[] = [];
    if (ownChannel.trim()) {
      setStep('own-channel');
      try {
        const res = await fetch('/api/own-channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ytApiKey: ytKey, ownChannel: ownChannel.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          ownChannelVideos = data.videos;
          setOwnVideos(ownChannelVideos);
        }
      } catch {}
    }

    // Step 3: Generate
    setStep('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, niche, outliers: scannedOutliers, ownVideos: ownChannelVideos, numRemixes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setViralRepeats(data.viralRepeats);
      setOutlierRemixes(data.outlierRemixes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setStep('idle');
      return;
    }

    setStep('done');
  };

  const downloadCSV = () => {
    const rows = [
      ['Type', 'Original Title', 'Generated Title', 'Link', 'Views', 'Velocity'],
      ...outliers.map(v => ['outlier', v.title, '', v.link, v.views, v.velocity]),
      ...viralRepeats.map(r => ['viral_repeat', r.originalTitle, r.generatedTitle, r.link, r.views, '']),
      ...outlierRemixes.map(r => ['outlier_remix', r.originalTitle, r.generatedTitle, r.link, r.views, r.velocity ?? '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `viral_topics_${niche.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stepLabel: Record<Step, string> = {
    idle: '',
    scanning: 'Scanning YouTube...',
    'own-channel': 'Fetching your channel...',
    generating: 'Generating ideas with AI...',
    done: '',
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">🔥 Viral Topic Finder</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Find trending videos in any niche and generate fresh content ideas with AI.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Setup Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Setup</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">YouTube API Key</span>
              <input
                type="password"
                value={ytKey}
                onChange={e => setYtKey(e.target.value)}
                placeholder="AIza..."
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Anthropic API Key</span>
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Your Niche</span>
              <input
                type="text"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g. fitness, personal finance, cooking"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Your Channel{' '}
                <span className="text-gray-400 font-normal">(optional — for fresh angle ideas)</span>
              </span>
              <input
                type="text"
                value={ownChannel}
                onChange={e => setOwnChannel(e.target.value)}
                placeholder="@yourchannel"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mb-5">
            <span className="text-sm font-medium text-gray-700 block mb-2">Top 5 Competitor Channels</span>
            <div className="grid grid-cols-5 gap-2">
              {competitors.map((c, i) => (
                <input
                  key={i}
                  type="text"
                  value={c}
                  onChange={e => {
                    const updated = [...competitors];
                    updated[i] = e.target.value;
                    setCompetitors(updated);
                  }}
                  placeholder={`@competitor${i + 1}`}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Remixes to generate:
            </span>
            <input
              type="range"
              min={5}
              max={15}
              value={numRemixes}
              onChange={e => setNumRemixes(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-semibold text-blue-600 w-6">{numRemixes}</span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={run}
            disabled={!isReady || isRunning}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {stepLabel[step]}
              </>
            ) : '🚀 Run Analysis'}
          </button>
        </div>

        {/* Outliers */}
        {outliers.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🔴 Top {outliers.length} Trending Outliers
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {outliers.map((v, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-3">
                  <img
                    src={thumbUrl(v.link)}
                    alt=""
                    className="w-28 h-16 object-cover rounded-lg bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2 leading-snug block"
                    >
                      {v.title}
                    </a>
                    <p className="text-xs text-gray-500 mt-0.5">{v.channel}</p>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-gray-400">{fmt(v.views)} views</span>
                      <span className="text-orange-500 font-semibold">{fmt(v.velocity)}/hr</span>
                      <span className="text-gray-400">{Math.round(v.hoursSinceUpload)}h ago</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Viral Repeats */}
        {viralRepeats.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🔵 Fresh Angles for Your Top Videos
            </h2>
            <div className="space-y-4">
              {viralRepeats.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 items-start">
                  <img
                    src={thumbUrl(r.link)}
                    alt=""
                    className="w-28 h-16 object-cover rounded-lg bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-2">
                      Original:{' '}
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                        {r.originalTitle}
                      </a>
                      {' '}— {fmt(r.views)} views
                    </p>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-semibold text-gray-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        {r.generatedTitle}
                      </p>
                      <button
                        onClick={() => copy(r.generatedTitle)}
                        className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {copied === r.generatedTitle ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Outlier Remixes */}
        {outlierRemixes.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              🟢 {outlierRemixes.length} Outlier Remixes
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Each captures the same emotional energy as a trending video, with a fresh angle for your channel.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {outlierRemixes.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <p className="text-xs text-gray-400 line-clamp-1 mb-1">
                    Inspired by:{' '}
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                      {r.originalTitle}
                    </a>
                  </p>
                  <p className="text-xs text-orange-500 font-semibold mb-2">
                    {fmt(r.velocity ?? 0)}/hr velocity
                  </p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-semibold text-gray-900 leading-snug">
                      {r.generatedTitle}
                    </p>
                    <button
                      onClick={() => copy(r.generatedTitle)}
                      className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {copied === r.generatedTitle ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Download */}
        {step === 'done' && (
          <div className="flex justify-center pb-8">
            <button
              onClick={downloadCSV}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-10 rounded-xl transition-colors"
            >
              ⬇️ Download All Results as CSV
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
