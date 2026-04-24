'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/dashboard');
    });
  }, [router]);

  const signIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    } else {
      router.replace('/dashboard');
    }
  };

  const signUp = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    else setAuthError('Check your email to confirm your account!');
    setAuthLoading(false);
  };

  const inputCls =
    'w-full bg-white border border-[#c8d9ef] rounded-lg px-4 py-3 text-sm text-navy placeholder-slate-muted focus:outline-none focus:border-navy transition-colors';

  return (
    <main className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: '#e8f0fa' }}>
      {/* Rounded hero-style card wrapping everything */}
      <div className="w-full max-w-md rounded-3xl px-10 py-14 flex flex-col items-center" style={{ backgroundColor: '#EAEFF8' }}>

        {/* Brand */}
        <div className="text-center mb-8 w-full">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <span className="font-heading font-[700] text-navy text-xl tracking-tight">Viral Topic Finder</span>
          </Link>
          <h1 className="font-heading text-[2rem] font-[700] text-navy leading-tight">
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-mid mt-2 text-sm">
            {authMode === 'login'
              ? 'Sign in to access your dashboard.'
              : 'Start finding viral topics in seconds.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="w-full">
          <div className="bg-white border border-[#c8d9ef] rounded-2xl p-8 shadow-sm">
          {/* Tab navigation */}
          <div className="flex mb-6 border-b border-[#c8d9ef]">
            {(['login', 'signup'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setAuthMode(mode); setAuthError(''); }}
                className="flex-1 pb-3 text-sm font-semibold text-navy transition-all"
                style={authMode === mode
                  ? { boxShadow: 'rgb(15, 23, 42) 0px -3px 0px 0px inset' }
                  : { color: '#94a3b8' }}
              >
                {mode === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              placeholder="Email address"
              className={inputCls}
            />
            <input
              type="password"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? signIn() : signUp())}
              className={inputCls}
            />
            {authError && (
              <p className={`text-xs px-1 ${authError.includes('Check your email') ? 'text-green-700' : 'text-red-600'}`}>
                {authError}
              </p>
            )}
            <button
              onClick={authMode === 'login' ? signIn : signUp}
              disabled={authLoading || !authEmail || !authPassword}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors mt-1"
              style={{
                backgroundColor: authLoading || !authEmail || !authPassword ? '#e2e8f0' : '#0f172a',
                color: authLoading || !authEmail || !authPassword ? '#94a3b8' : '#ffffff',
                cursor: authLoading || !authEmail || !authPassword ? 'not-allowed' : 'pointer',
              }}
            >
              {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>

          <p className="text-center text-xs text-slate-muted mt-5">
            By signing up you agree to our{' '}
            <Link href="/" className="text-navy underline">terms of service</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
