'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'rjhassanali555@gmail.com';

interface Payment {
  id: string;
  user_email: string;
  transaction_id: string;
  amount_pkr: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email === ADMIN_EMAIL && session) {
        fetchPayments(session.access_token);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchPayments = async (token: string) => {
    setLoading(true);
    const res = await fetch('/api/admin/payments', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPayments(data.payments ?? []);
    setLoading(false);
  };

  const handleAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setActionLoading(paymentId + action);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ paymentId, action }),
    });
    if (res.ok) {
      setPayments(prev =>
        prev.map(p => p.id === paymentId ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' } : p)
      );
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-bg flex items-center justify-center text-slate-muted">
        Loading...
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-sky-bg flex items-center justify-center">
        <p className="text-slate-muted">Access denied.</p>
      </div>
    );
  }

  const pending = payments.filter(p => p.status === 'pending');
  const reviewed = payments.filter(p => p.status !== 'pending');

  return (
    <main className="min-h-screen bg-sky-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-[1.75rem] font-[700] text-navy leading-tight">Payment Approvals</h1>
          <p className="text-sm text-slate-muted mt-1">
            Verify each transaction ID in your EasyPaisa app, then approve or reject.
          </p>
        </div>

        {pending.length === 0 && (
          <div className="bg-white rounded-xl border border-[#c8d9ef] p-8 text-center text-slate-muted mb-6">
            No pending payments — you&apos;re all caught up.
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-3 mb-8">
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest">
              Pending ({pending.length})
            </p>
            {pending.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-xl p-4 flex items-center gap-4"
                style={{ border: '1px solid #0f172a' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{p.user_email}</p>
                  <p className="text-xs text-slate-muted mt-0.5">
                    Transaction ID: <span className="font-mono font-medium text-slate-mid">{p.transaction_id}</span>
                  </p>
                  <p className="text-xs text-slate-muted mt-0.5">
                    PKR {p.amount_pkr.toLocaleString()} &middot; {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(p.id, 'approve')}
                    disabled={actionLoading !== null}
                    className="font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      backgroundColor: actionLoading !== null ? '#e2e8f0' : '#0f172a',
                      color: actionLoading !== null ? '#94a3b8' : '#ffffff',
                      cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === p.id + 'approve' ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'reject')}
                    disabled={actionLoading !== null}
                    className="font-semibold px-4 py-2 rounded-lg text-sm bg-white hover:bg-sky-bg transition-colors text-navy"
                    style={{
                      border: '1px solid #c8d9ef',
                      cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                      opacity: actionLoading !== null ? 0.5 : 1,
                    }}
                  >
                    {actionLoading === p.id + 'reject' ? '...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {reviewed.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-widest">Reviewed</p>
            {reviewed.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-[#c8d9ef] p-4 flex items-center gap-4 opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{p.user_email}</p>
                  <p className="text-xs text-slate-muted">
                    Transaction ID: <span className="font-mono text-slate-mid">{p.transaction_id}</span>
                  </p>
                  <p className="text-xs text-slate-muted">
                    PKR {p.amount_pkr.toLocaleString()} &middot; {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0"
                  style={p.status === 'approved'
                    ? { backgroundColor: '#0f172a', color: '#ffffff' }
                    : { backgroundColor: '#e2e8f0', color: '#64748b', border: '1px solid #c8d9ef' }}
                >
                  {p.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
