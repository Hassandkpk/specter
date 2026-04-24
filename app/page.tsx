'use client';

import { useState, useEffect } from 'react';
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

export default function Home() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pkrAmount, setPkrAmount] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [existingPayment, setExistingPayment] = useState<{ transaction_id: string; status: string } | null>(null);

  // Form
  const [niche, setNiche] = useState('');
  const [ownChannel, setOwnChannel] = useState('');
  const [competitors, setCompetitors] = useState(['', '', '', '', '']);
  const [numRemixes, setNumRemixes] = useState(10);

  // Discovery
  const [competitorMode, setCompetitorMode] = useState<'auto' | 'manual'>('manual');
  const [seedChannel, setSeedChannel] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [discoveredChannels, setDiscoveredChannels] = useState<DiscoveredChannel[]>([]);

  // Results
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
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('competitors');
    if (saved) setCompetitors(JSON.parse(saved));
    setNiche(localStorage.getItem('niche') || '');
    setOwnChannel(localStorage.getItem('ownChannel') || '');
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data as Profile);

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

  const signIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const signUp = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    else setAuthError('Check your email to confirm your account!');
    setAuthLoading(false);
  };

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

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const dailyUsed = profile ? (profile.last_run_date === today ? profile.daily_runs : 0) : 0;
  const monthlyUsed = profile ? (profile.last_run_month === thisMonth ? profile.monthly_runs : 0) : 0;
  const DAILY_LIMIT = profile?.plan === 'paid' ? 5 : 3;
  const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyUsed);
  const monthlyRemaining = profile?.plan === 'paid' ? Math.max(0, 150 - monthlyUsed) : null;

  const isReady = !!user && !!niche && competitors.some(c => c.trim()) && dailyRemaining > 0;
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
      if (!channels.length) {
        setDiscoverError('No relevant channels found — try a different seed channel.');
        return;
      }
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
    setOutliers([]);
    setOwnVideos([]);
    setViralRepeats([]);
    setOutlierRemixes([]);
    setMinimalTwists([]);

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
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ownChannel: ownChannel.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          ownChannelVideos = data.videos;
          setOwnVideos(ownChannelVideos);
        }
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
      ...minimalTwists.map(r => ['minimal_twist', r.originalTitle, r.generatedTitle, r.link, r.views, r.velocity ?? '']),
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

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Brand */}
        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-500/30 mb-5 text-3xl">
            🔥
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Viral Topic Finder</h1>
          <p className="text-slate-400 mt-2.5 text-base max-w-xs mx-auto leading-relaxed">
            Find trending videos. Generate content ideas. Grow your channel faster.
          </p>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-sm relative z-10">
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-xl p-1">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  authMode === 'login'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  authMode === 'signup'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Sign up
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? signIn() : signUp())}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
              {authError && (
                <p className={`text-xs px-1 ${authError.includes('Check your email') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {authError}
                </p>
              )}
              <button
                onClick={authMode === 'login' ? signIn : signUp}
                disabled={authLoading || !authEmail || !authPassword}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/20 mt-1"
              >
                {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-5">
            By signing up you agree to our terms of service.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🔥 Viral Topic Finder</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Find trending videos in any niche and generate fresh content ideas with AI.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {profile?.plan === 'free' && (
              <button
                onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow shadow-violet-500/20"
              >
                Upgrade to Pro
              </button>
            )}
            <div className="text-right">
              <p className="text-sm text-gray-600 truncate max-w-[180px]">{user.email}</p>
              <div className="flex items-center gap-2 justify-end mt-0.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  profile?.plan === 'paid'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {profile?.plan === 'paid' ? 'Pro' : 'Free'}
                </span>
                <span className="text-xs text-gray-400">
                  {dailyRemaining}/{DAILY_LIMIT} today
                  {monthlyRemaining != null && ` · ${monthlyRemaining}/150 this month`}
                </span>
              </div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Setup Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Setup</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Your Niche</span>
                <input
                  type="text"
                  value={niche}
                  onChange={e => { setNiche(e.target.value); localStorage.setItem('niche', e.target.value); }}
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
                  onChange={e => { setOwnChannel(e.target.value); localStorage.setItem('ownChannel', e.target.value); }}
                  placeholder="@yourchannel"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Competitor mode toggle */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Competitor Channels</span>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setCompetitorMode('manual')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      competitorMode === 'manual'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Add Manually
                  </button>
                  <button
                    onClick={() => setCompetitorMode('auto')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      competitorMode === 'auto'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Auto-discover
                  </button>
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
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={discoverChannels}
                      disabled={isDiscovering || !seedChannel.trim()}
                      className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
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
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                        {discoveredChannels.length} channels found
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {discoveredChannels.map((ch, i) => (
                          <a
                            key={i}
                            href={`https://www.youtube.com/${ch.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-36 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          >
                            {ch.avatar ? (
                              <img src={ch.avatar} alt={ch.name} className="w-12 h-12 rounded-full object-cover bg-gray-200" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-lg font-bold">
                                {ch.name.charAt(0)}
                              </div>
                            )}
                            <p className="text-xs font-semibold text-gray-800 text-center leading-tight line-clamp-2">{ch.name}</p>
                            <p className="text-xs text-gray-400">{fmt(ch.subscribers)} subs</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
              ) : dailyRemaining === 0
                ? 'Daily limit reached — come back tomorrow'
                : '🚀 Run Analysis'}
            </button>

            {/* EasyPaisa upgrade */}
            {profile?.plan === 'free' && (
              <div id="upgrade-section" className="mt-4 pt-4 border-t border-gray-100">
                {existingPayment?.status === 'pending' || paymentSubmitted ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-yellow-800">Payment under review</p>
                    <p className="text-xs text-yellow-700 mt-0.5">
                      Transaction ID: <span className="font-mono">{existingPayment?.transaction_id ?? transactionId}</span>
                      {' '}— you&apos;ll be upgraded within a few hours.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-800 mb-3">
                      Upgrade to Pro — $9/month
                      {pkrAmount ? <span className="text-gray-500 font-normal"> (PKR {pkrAmount.toLocaleString()})</span> : ''}
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-gray-500 mb-1">Send via EasyPaisa to:</p>
                      <p className="text-lg font-bold text-gray-900 tracking-wide">03355870108</p>
                      <p className="text-sm text-gray-600">Hassan Ali</p>
                      {pkrAmount && (
                        <p className="text-sm font-semibold text-green-700 mt-1">
                          Amount: PKR {pkrAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">After sending, enter your EasyPaisa transaction ID:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        placeholder="e.g. MP241234567890"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={submitPayment}
                        disabled={submittingPayment || !transactionId.trim()}
                        className="flex-shrink-0 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
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

        {/* Minimal Twists */}
        {minimalTwists.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              🟡 10% Twist Titles
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Same title, stronger words — just enough to avoid duplicate content without losing the viral angle.
            </p>
            <div className="space-y-3">
              {minimalTwists.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 items-start">
                  <img
                    src={thumbUrl(r.link)}
                    alt=""
                    className="w-28 h-16 object-cover rounded-lg bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1 line-clamp-1">
                      Original: <span className="text-gray-600">{r.originalTitle}</span>
                    </p>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-semibold text-gray-900 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
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
