'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { VideoResult, GeneratedResult, DiscoveredChannel, Profile } from '@/types';

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

const inputCls =
  'w-full bg-white border border-[#bfdbfe] rounded-lg px-3 py-2 text-sm text-navy placeholder-slate-muted focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all';

const copyBtnStyle = {
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
};

const blueBtn = {
  background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
  color: '#ffffff',
  cursor: 'pointer',
} as const;

const blueBtnDisabled = {
  backgroundColor: '#e2e8f0',
  color: '#94a3b8',
  cursor: 'not-allowed',
} as const;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pkrAmount, setPkrAmount] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [existingPayment, setExistingPayment] = useState<{ transaction_id: string; status: string } | null>(null);

  const [niche, setNiche] = useState('');
  const [ownChannel, setOwnChannel] = useState('');
  const [competitorCount, setCompetitorCount] = useState(5);
  const [competitors, setCompetitors] = useState(['', '', '', '', '']);
  const [nichePresets, setNichePresets] = useState<{ id: string; name: string; competitors: string[]; competitorCount: number }[]>([]);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [numRemixes, setNumRemixes] = useState(10);

  const [competitorMode, setCompetitorMode] = useState<'auto' | 'manual'>('manual');
  const [seedChannel, setSeedChannel] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [discoveredChannels, setDiscoveredChannels] = useState<DiscoveredChannel[]>([]);

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [outliers, setOutliers] = useState<VideoResult[]>([]);
  const [ownVideos, setOwnVideos] = useState<VideoResult[]>([]);
  const [viralRepeats, setViralRepeats] = useState<GeneratedResult[]>([]);
  const [outlierRemixes, setOutlierRemixes] = useState<GeneratedResult[]>([]);
  const [minimalTwists, setMinimalTwists] = useState<GeneratedResult[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/login'); return; }
      setSession(session);
      setUser(session.user);
      fetchProfile(session.user.id, session.access_token);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { router.replace('/login'); return; }
      setSession(session);
      setUser(session.user);
      fetchProfile(session.user.id, session.access_token);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem('competitors');
    if (saved) setCompetitors(JSON.parse(saved));
    setNiche(localStorage.getItem('niche') || '');
    setOwnChannel(localStorage.getItem('ownChannel') || '');
    const savedPresets = localStorage.getItem('nichePresets');
    if (savedPresets) setNichePresets(JSON.parse(savedPresets));
  }, []);

  const fetchProfile = async (userId: string, token: string) => {
    try {
      const res = await fetch('/api/init-credits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.profile) setProfile(data.profile as Profile);
    } catch {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data as Profile);
    }

    const { data: payment } = await supabase
      .from('pending_payments')
      .select('transaction_id, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payment) setExistingPayment(payment);
  };

  useEffect(() => {
    fetch('/api/usd-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setPkrAmount(Math.round(9 * d.rate)); });
  }, []);

  const submitPayment = async () => {
    if (!transactionId.trim() || !session || !pkrAmount) return;
    setSubmittingPayment(true);
    setPaymentError('');
    try {
      const res = await fetch('/api/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ transactionId, amountPkr: pkrAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPaymentSubmitted(true);
      setExistingPayment({ transaction_id: transactionId, status: 'pending' });
      setTransactionId('');
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const credits = profile?.credits ?? 0;
  const remixCost = numRemixes * 10;
  const isReady = !!user && !!niche && competitors.some(c => c.trim()) && credits >= remixCost;
  const isRunning = step !== 'idle' && step !== 'done';

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  });

  const discoverChannels = async () => {
    if (!session || !seedChannel.trim()) return;
    setDiscoverError('');
    setDiscoveredChannels([]);
    setIsDiscovering(true);
    try {
      const res = await fetch('/api/discover-channels', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ seedHandle: seedChannel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const channels = data.channels as DiscoveredChannel[];
      if (!channels.length) { setDiscoverError('No relevant channels found — try a different seed channel.'); return; }
      setDiscoveredChannels(channels);
      const filled = [...channels.map(c => c.handle), '', '', '', '', ''].slice(0, 5);
      setCompetitors(filled);
      localStorage.setItem('competitors', JSON.stringify(filled));
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const run = async () => {
    setError('');
    setOutliers([]); setOwnVideos([]); setViralRepeats([]); setOutlierRemixes([]); setMinimalTwists([]);

    const validCompetitors = competitors
      .filter(c => c.trim())
      .map(h => ({ name: h.trim().replace('@', ''), handle: h.trim() }));

    setStep('scanning');
    let scannedOutliers: VideoResult[] = [];
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ niche, competitors: validCompetitors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      scannedOutliers = data.outliers;
      setOutliers(scannedOutliers);
      if (data.profile) setProfile(data.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStep('idle');
      return;
    }

    let ownChannelVideos: VideoResult[] = [];
    if (ownChannel.trim()) {
      setStep('own-channel');
      try {
        const res = await fetch('/api/own-channel', {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ ownChannel: ownChannel.trim() }),
        });
        const data = await res.json();
        if (res.ok) { ownChannelVideos = data.videos; setOwnVideos(ownChannelVideos); }
      } catch {}
    }

    setStep('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ niche, outliers: scannedOutliers, ownVideos: ownChannelVideos, numRemixes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setViralRepeats(data.viralRepeats);
      setOutlierRemixes(data.outlierRemixes);
      setMinimalTwists(data.minimalTwists);
      if (typeof data.creditsRemaining === 'number') {
        setProfile(prev => prev ? { ...prev, credits: data.creditsRemaining } : prev);
      }
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
      ...outliers.map(v => ['Trending Outlier', v.title, '', v.link, v.views, v.velocity]),
      ...viralRepeats.map(r => ['New Topics Based on Previous Viral Topics', r.originalTitle, r.generatedTitle, r.link, r.views, '']),
      ...outlierRemixes.map(r => ['New Topics You Can Cover', r.originalTitle, r.generatedTitle, r.link, r.views, r.velocity ?? '']),
      ...minimalTwists.map(r => ['Outlier Topics', r.originalTitle, r.generatedTitle, r.link, r.views, r.velocity ?? '']),
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
    idle: '', scanning: 'Scanning YouTube...', 'own-channel': 'Fetching your channel...', generating: 'Generating ideas with AI...', done: '',
  };

  if (!user) return null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#eef4ff' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#bfdbfe]" style={{ backgroundColor: 'rgba(238,244,255,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-end gap-4">
          {profile?.plan === 'free' && (
            <button
              onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-90 hover:shadow-md"
              style={blueBtn}
            >
              Upgrade to Pro
            </button>
          )}
          <div className="text-right">
            <p className="text-sm text-navy truncate max-w-[200px]">{user.email}</p>
            <div className="flex items-center gap-2 justify-end mt-0.5">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={profile?.plan === 'paid'
                  ? { background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#ffffff' }
                  : { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
              >
                {profile?.plan === 'paid' ? '✦ Pro' : 'Free'}
              </span>
              <span className="text-xs font-semibold text-[#2563eb]">
                {credits.toLocaleString()} credits
              </span>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
            className="text-xs text-slate-muted hover:text-[#2563eb] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Branding */}
        <div className="text-center py-4">
          <h1
            className="font-heading font-[800] text-4xl leading-tight"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Spector
          </h1>
          <p className="text-[#3b82f6] text-sm mt-1 font-medium">Find Topics in Minutes</p>
        </div>

        {/* Setup Card */}
        <div className="bg-white rounded-2xl border border-[#bfdbfe] p-6 shadow-sm" style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.07)' }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#2563eb,#0ea5e9)' }} />
            <p className="text-xs font-bold text-[#2563eb] uppercase tracking-widest">Setup</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-navy">Your Niche</span>
              <input
                type="text"
                value={niche}
                onChange={e => { setNiche(e.target.value); localStorage.setItem('niche', e.target.value); }}
                placeholder="e.g. fitness, personal finance, cooking"
                className={`mt-1 ${inputCls}`}
              />
              {/* Niche presets bar */}
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setPresetDropdownOpen(o => !o)}
                    className="w-full flex items-center justify-between border border-[#bfdbfe] rounded-lg px-3 py-1.5 text-xs bg-white text-navy hover:border-[#2563eb] transition-colors"
                  >
                    <span className="text-slate-muted">{nichePresets.length === 0 ? 'No saved niches yet' : 'Switch niche...'}</span>
                    <span className="text-slate-muted ml-2">▾</span>
                  </button>
                  {presetDropdownOpen && nichePresets.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#bfdbfe] rounded-lg shadow-lg overflow-hidden">
                      {nichePresets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#f0f5fc] transition-colors">
                          <button
                            type="button"
                            className="flex-1 text-left text-xs font-medium text-navy truncate"
                            onClick={() => {
                              setNiche(preset.name);
                              setCompetitors(preset.competitors);
                              setCompetitorCount(preset.competitorCount);
                              localStorage.setItem('niche', preset.name);
                              localStorage.setItem('competitors', JSON.stringify(preset.competitors));
                              setPresetDropdownOpen(false);
                            }}
                          >
                            {preset.name}
                          </button>
                          <button
                            type="button"
                            className="ml-2 text-slate-muted hover:text-red-500 text-xs font-bold flex-shrink-0 transition-colors"
                            onClick={() => {
                              const updated = nichePresets.filter(p => p.id !== preset.id);
                              setNichePresets(updated);
                              localStorage.setItem('nichePresets', JSON.stringify(updated));
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!niche.trim() || nichePresets.length >= 5}
                  onClick={() => {
                    const updated = [...nichePresets, { id: crypto.randomUUID(), name: niche.trim(), competitors, competitorCount }];
                    setNichePresets(updated);
                    localStorage.setItem('nichePresets', JSON.stringify(updated));
                    setPresetDropdownOpen(false);
                  }}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                  style={!niche.trim() || nichePresets.length >= 5 ? blueBtnDisabled : { ...blueBtn, border: 'none' }}
                >
                  Save{nichePresets.length > 0 ? ` (${nichePresets.length}/5)` : ''}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-navy">
                Your Channel{' '}
                <span className="text-slate-muted font-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={ownChannel}
                onChange={e => { setOwnChannel(e.target.value); localStorage.setItem('ownChannel', e.target.value); }}
                placeholder="@yourchannel"
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>

          {/* Competitor mode toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-navy">Competitor Channels</span>
                <div className="flex border border-[#bfdbfe] rounded-lg overflow-hidden">
                  {[5, 10, 15, 20].map((n, i) => (
                    <button
                      key={n}
                      onClick={() => {
                        setCompetitorCount(n);
                        setCompetitors(prev => {
                          const next = [...prev];
                          while (next.length < n) next.push('');
                          return next.slice(0, n);
                        });
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold transition-all ${i > 0 ? 'border-l border-[#bfdbfe]' : ''}`}
                      style={competitorCount === n
                        ? { background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#ffffff' }
                        : { backgroundColor: '#ffffff', color: '#94a3b8' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex border border-[#bfdbfe] rounded-lg overflow-hidden">
                {(['manual', 'auto'] as const).map((mode, i) => (
                  <button
                    key={mode}
                    onClick={() => setCompetitorMode(mode)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${i > 0 ? 'border-l border-[#bfdbfe]' : ''}`}
                    style={competitorMode === mode
                      ? { background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#94a3b8' }}
                  >
                    {mode === 'manual' ? 'Add Manually' : 'Auto-discover'}
                  </button>
                ))}
              </div>
            </div>

            {competitorMode === 'manual' ? (
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
                      localStorage.setItem('competitors', JSON.stringify(updated));
                    }}
                    placeholder={`@competitor${i + 1}`}
                    className="border border-[#bfdbfe] rounded-lg px-3 py-2 text-sm bg-white text-navy placeholder-slate-muted focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seedChannel}
                    onChange={e => setSeedChannel(e.target.value)}
                    placeholder="@handle, channel URL, ID, or name"
                    className="flex-1 border border-[#c8d9ef] rounded-lg px-3 py-2 text-sm bg-white text-navy placeholder-slate-muted focus:outline-none focus:border-navy transition-colors"
                  />
                  <button
                    onClick={discoverChannels}
                    disabled={isDiscovering || !seedChannel.trim()}
                    className="flex-shrink-0 font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                    style={isDiscovering || !seedChannel.trim() ? blueBtnDisabled : blueBtn}
                  >
                    {isDiscovering ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Discovering...
                      </>
                    ) : 'Auto-discover'}
                  </button>
                </div>
                {discoverError && <p className="text-xs text-red-600 mt-1">{discoverError}</p>}

                {discoveredChannels.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-muted mb-2 uppercase tracking-widest">
                      {discoveredChannels.length} channels found
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {discoveredChannels.map((ch, i) => (
                        <a
                          key={i}
                          href={`https://www.youtube.com/${ch.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-36 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-[#2563eb] hover:shadow-md transition-all"
                        >
                          {ch.avatar ? (
                            <img src={ch.avatar} alt={ch.name} className="w-12 h-12 rounded-full object-cover bg-[#e2e8f0]" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#e2e8f0] flex items-center justify-center text-slate-muted text-lg font-bold">
                              {ch.name.charAt(0)}
                            </div>
                          )}
                          <p className="text-xs font-semibold text-navy text-center leading-tight line-clamp-2">{ch.name}</p>
                          <p className="text-xs text-slate-muted">{fmt(ch.subscribers)} subs</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-4 mb-1">
            <span className="text-sm font-medium text-navy whitespace-nowrap">Topics to generate:</span>
            <input type="range" min={5} max={15} value={numRemixes} onChange={e => setNumRemixes(Number(e.target.value))} className="flex-1" style={{ accentColor: '#2563eb' }} />
            <span className="text-sm font-bold w-8 text-center rounded-lg py-0.5" style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff' }}>{numRemixes}</span>
          </div>
          <p className="text-xs mb-4" style={{ color: '#3b82f6' }}>
            ~{remixCost} credits{ownChannel.trim() ? ' + 5 per own video' : ''} · <span className="font-semibold">{credits.toLocaleString()} available</span>
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={run}
            disabled={!isReady || isRunning}
            className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl transition-all hover:opacity-90 hover:shadow-lg"
            style={{
              padding: '16px 24px',
              ...(!isReady || isRunning
                ? blueBtnDisabled
                : { background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37,99,235,0.35)' }),
            }}
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {stepLabel[step]}
              </>
            ) : credits < remixCost
              ? `Not enough credits — need ${remixCost}, have ${credits}`
              : 'Run Analysis'}
          </button>

          {credits > 0 && credits < 100 && !isRunning && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              Running low — {credits} credits left.{' '}
              <button
                onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="underline font-semibold"
              >
                Upgrade to get 10,000 credits/month
              </button>
            </p>
          )}
          {credits === 0 && profile?.signup_ip !== null && !isRunning && (
            <p className="text-xs text-red-600 mt-2 text-center">
              No credits remaining.{' '}
              <button
                onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="underline font-semibold"
              >
                Upgrade to continue
              </button>
            </p>
          )}

          {/* Upgrade section */}
          {profile?.plan === 'free' && (
            <div id="upgrade-section" className="mt-4 pt-4 border-t border-[#bfdbfe]">
              {existingPayment?.status === 'pending' || paymentSubmitted ? (
                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-3">
                  <p className="text-sm font-semibold text-navy">Payment under review</p>
                  <p className="text-xs text-slate-muted mt-0.5">
                    Transaction ID: <span className="font-mono text-slate-mid">{existingPayment?.transaction_id ?? transactionId}</span>
                    {' '}— you&apos;ll be upgraded within a few hours.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-navy mb-3">
                    Upgrade to Pro — $5/month
                    {pkrAmount ? <span className="text-slate-muted font-normal"> (PKR {pkrAmount.toLocaleString()})</span> : ''}
                  </p>
                  <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-3 mb-3">
                    <p className="text-xs text-slate-muted mb-1">Send via EasyPaisa to:</p>
                    <p className="text-lg font-bold text-navy tracking-wide">03355870108</p>
                    <p className="text-sm text-slate-mid">Hassan Ali</p>
                    {pkrAmount && (
                      <p className="text-sm font-semibold text-navy mt-1">Amount: PKR {pkrAmount.toLocaleString()}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-muted mb-2">After sending, enter your EasyPaisa transaction ID:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      placeholder="e.g. MP241234567890"
                      className="flex-1 border border-[#c8d9ef] rounded-lg px-3 py-2 text-sm bg-white text-navy placeholder-slate-muted focus:outline-none focus:border-navy transition-colors"
                    />
                    <button
                      onClick={submitPayment}
                      disabled={submittingPayment || !transactionId.trim()}
                      className="flex-shrink-0 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                      style={submittingPayment || !transactionId.trim() ? blueBtnDisabled : blueBtn}
                    >
                      {submittingPayment ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                  {paymentError && <p className="text-xs text-red-600 mt-1">{paymentError}</p>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Trending Outliers */}
        {outliers.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#2563eb,#0ea5e9)' }} />
                <h2 className="text-2xl font-bold text-navy">Trending Outliers</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff' }}>Top {outliers.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {outliers.map((v, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#bfdbfe] p-4 flex gap-3 hover:border-[#2563eb] hover:shadow-md transition-all" style={{ boxShadow: '0 2px 8px rgba(37,99,235,0.04)' }}>
                  <img
                    src={thumbUrl(v.link)} alt=""
                    className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
                    style={{ border: '1px solid #bfdbfe' }}
                  />
                  <div className="flex-1 min-w-0">
                    <a href={v.link} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-navy hover:text-[#2563eb] line-clamp-2 leading-snug block transition-colors">
                      {v.title}
                    </a>
                    <p className="text-xs text-slate-muted mt-0.5">{v.channel}</p>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-slate-muted">{fmt(v.views)} views</span>
                      <span className="font-bold" style={{ color: '#0ea5e9' }}>{fmt(v.velocity)}/hr</span>
                      <span className="text-slate-muted">{Math.round(v.hoursSinceUpload)}h ago</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 10% Twist Titles */}
        {minimalTwists.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#2563eb,#0ea5e9)' }} />
              <h2 className="text-2xl font-bold text-navy">Outlier Topics</h2>
            </div>
            <p className="text-sm text-slate-muted mb-4 ml-3">Same title, stronger words — just enough to avoid duplicate content.</p>
            <div className="space-y-3">
              {minimalTwists.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#bfdbfe] p-4 flex gap-4 items-start hover:border-[#2563eb] hover:shadow-md transition-all" style={{ boxShadow: '0 2px 8px rgba(37,99,235,0.04)' }}>
                  <img src={thumbUrl(r.link)} alt=""
                    className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
                    style={{ border: '1px solid #bfdbfe' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-muted mb-1 line-clamp-1">
                      Original: <span className="text-slate-mid">{r.originalTitle}</span>
                    </p>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] rounded-lg px-3 py-2">
                        {r.generatedTitle}
                      </p>
                      <button onClick={() => copy(r.generatedTitle)}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:shadow-sm"
                        style={copied === r.generatedTitle ? { ...blueBtn, padding: '8px 12px' } : copyBtnStyle}>
                        {copied === r.generatedTitle ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fresh Angles */}
        {viralRepeats.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#2563eb,#0ea5e9)' }} />
              <h2 className="text-2xl font-bold text-navy">New Topics Based on Previous Viral Topics</h2>
            </div>
            <div className="space-y-4">
              {viralRepeats.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#bfdbfe] p-4 flex gap-4 items-start hover:border-[#2563eb] hover:shadow-md transition-all" style={{ boxShadow: '0 2px 8px rgba(37,99,235,0.04)' }}>
                  <img src={thumbUrl(r.link)} alt=""
                    className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
                    style={{ border: '1px solid #bfdbfe' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-muted mb-2">
                      Original:{' '}
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:text-[#1d4ed8] transition-colors">
                        {r.originalTitle}
                      </a>
                      {' '}— {fmt(r.views)} views
                    </p>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] rounded-lg px-3 py-2">
                        {r.generatedTitle}
                      </p>
                      <button onClick={() => copy(r.generatedTitle)}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:shadow-sm"
                        style={copied === r.generatedTitle ? { ...blueBtn, padding: '8px 12px' } : copyBtnStyle}>
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
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#2563eb,#0ea5e9)' }} />
                  <h2 className="text-2xl font-bold text-navy">New Topics You Can Cover</h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff' }}>{outlierRemixes.length} ideas</span>
              </div>
              <p className="text-sm text-slate-muted mt-1 ml-3">Same emotional energy as a trending video, with a fresh angle for your channel.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {outlierRemixes.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#bfdbfe] p-4 hover:border-[#2563eb] hover:shadow-md transition-all" style={{ boxShadow: '0 2px 8px rgba(37,99,235,0.04)' }}>
                  <p className="text-xs text-slate-muted line-clamp-1 mb-1">
                    Inspired by:{' '}
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:text-[#1d4ed8] transition-colors">
                      {r.originalTitle}
                    </a>
                  </p>
                  <p className="text-xs font-bold mb-2" style={{ color: '#0ea5e9' }}>{fmt(r.velocity ?? 0)}/hr velocity</p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-semibold text-[#1d4ed8] leading-snug bg-[#eff6ff] rounded-lg px-3 py-2">{r.generatedTitle}</p>
                    <button onClick={() => copy(r.generatedTitle)}
                      className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:shadow-sm whitespace-nowrap"
                      style={copied === r.generatedTitle ? { ...blueBtn, padding: '8px 12px' } : copyBtnStyle}>
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
              className="font-semibold rounded-xl text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', boxShadow: '0 4px 15px rgba(37,99,235,0.35)' }}
            >
              Download All Results as CSV
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
