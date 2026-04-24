import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen font-sans" style={{ backgroundColor: '#e8f0fa' }}>

      {/* ── Header — absolute, floats over hero with blur ───────────────── */}
      <header
        className="absolute top-4 left-6 right-6 z-50 flex items-center justify-between px-6 py-3 rounded-2xl border"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(234, 239, 248, 0.65)',
          borderColor: 'rgba(200, 217, 239, 0.7)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-heading font-[700] text-navy text-base tracking-tight">
            Viral Topic Finder
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-slate-mid hover:text-navy transition-colors">
            How It Works
          </a>
          <a href="#pricing" className="text-sm font-medium text-slate-mid hover:text-navy transition-colors">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-navy px-4 py-2 rounded-lg border transition-colors hover:bg-white/60"
            style={{ backgroundColor: 'rgba(234,239,248,0.5)', borderColor: '#c8d9ef' }}
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0f172a' }}
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* ── Hero — rounded card with side margins ───────────────────────── */}
      <section
        className="relative mx-5 rounded-3xl overflow-hidden pt-44 pb-28 px-6 text-center"
        style={{ backgroundColor: '#EAEFF8' }}
      >
        <div className="max-w-2xl mx-auto">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold uppercase tracking-wide border"
            style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderColor: '#c8d9ef', color: '#475569' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-z-orange inline-block" />
            AI-Powered YouTube Trend Scanner
          </div>
          <h1 className="font-heading text-[3.25rem] font-[700] text-navy leading-[1.05] tracking-tight mb-5">
            Find Viral YouTube Topics<br />Before Anyone Else Does.
          </h1>
          <p className="text-lg text-slate-mid leading-relaxed mb-8 max-w-lg mx-auto">
            Scan competitor channels, detect trending outliers, and get AI-generated title ideas — in seconds.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="text-base font-semibold text-white px-7 py-3.5 rounded-xl transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0f172a' }}
            >
              Start Free Now →
            </Link>
            <a
              href="#how-it-works"
              className="text-base font-semibold text-navy px-7 py-3.5 rounded-xl border transition-colors hover:bg-white/60"
              style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderColor: '#c8d9ef' }}
            >
              See How It Works
            </a>
          </div>
          <p className="text-sm text-slate-muted mt-4">No credit card required · 1 free run included</p>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-5 mt-4 rounded-3xl bg-white py-14 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest mb-2">How It Works</p>
            <h2 className="font-heading text-[2rem] font-[700] text-navy leading-tight">
              From niche to viral ideas in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step: '01', title: 'Enter Your Niche', desc: 'Type your content niche and add up to 5 competitor YouTube channels you want to track.' },
              { step: '02', title: 'Run AI Analysis', desc: "Our AI scans hundreds of recent videos, detects viral outliers, and identifies what's trending right now." },
              { step: '03', title: 'Copy Viral Ideas', desc: 'Get AI-generated title remixes inspired by trending videos — ready to copy and use for your next upload.' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-6 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2eaf4' }}>
                <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest mb-1.5">{s.step}</p>
                <h3 className="font-heading text-lg font-[600] text-navy mb-2">{s.title}</h3>
                <p className="text-slate-mid text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-5 mt-4 rounded-3xl py-14 px-8" style={{ backgroundColor: '#EAEFF8' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="font-heading text-[2rem] font-[700] text-navy leading-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-mid mt-2 text-sm">Pay via EasyPaisa. No subscription traps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Free */}
            <div className="bg-white border border-[#c8d9ef] rounded-2xl p-6 flex flex-col">
              <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest mb-2">Free</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-heading text-4xl font-[700] text-navy">$0</span>
              </div>
              <p className="text-sm text-slate-mid mb-6">Try it once, no commitment.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['1 run, forever', 'Trending outlier scan', 'AI title generation', 'CSV export'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-mid">
                    <span className="text-navy font-bold text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="w-full text-center text-sm font-semibold text-navy py-2.5 rounded-xl border border-[#c8d9ef] hover:bg-sky-bg transition-colors">
                Try Free
              </Link>
            </div>

            {/* Monthly */}
            <div className="bg-white border border-[#c8d9ef] rounded-2xl p-6 flex flex-col">
              <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest mb-2">Monthly</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-heading text-4xl font-[700] text-navy">$5</span>
                <span className="text-slate-mid text-sm mb-1.5">/month</span>
              </div>
              <p className="text-sm text-slate-mid mb-6">For active creators.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['3 runs/day', 'Trending outlier scan', 'AI title generation', 'CSV export', 'Priority processing'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-mid">
                    <span className="text-navy font-bold text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="w-full text-center text-sm font-semibold text-navy py-2.5 rounded-xl border border-[#c8d9ef] hover:bg-sky-bg transition-colors">
                Get Started
              </Link>
            </div>

            {/* Lifetime */}
            <div className="rounded-2xl p-6 flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
              <div className="absolute top-4 right-4 bg-z-orange text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Best Value
              </div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Lifetime</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-heading text-4xl font-[700] text-white">$90</span>
                <span className="text-white/50 text-sm mb-1.5">once</span>
              </div>
              <p className="text-sm text-white/60 mb-6">Pay once, use forever.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['3 runs/day forever', 'Trending outlier scan', 'AI title generation', 'CSV export', 'Priority processing', 'All future updates'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <span className="text-z-orange font-bold text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="w-full text-center text-sm font-semibold text-navy py-2.5 rounded-xl bg-white hover:bg-sky-bg transition-colors">
                Get Lifetime Access
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-slate-muted mt-6">
            All plans paid via EasyPaisa · Activation within a few hours
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mx-5 mt-4 mb-5 rounded-3xl py-8 px-8" style={{ backgroundColor: '#0f172a' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-[700] text-white text-sm">Viral Topic Finder</span>
          </div>
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Viral Topic Finder. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs text-white/50 hover:text-white transition-colors">Sign In</Link>
            <Link href="/login" className="text-xs text-white/50 hover:text-white transition-colors">Get Started</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
