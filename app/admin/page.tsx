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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email === ADMIN_EMAIL && session) {
        fetchPayments(session.access_token);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ paymentId, action }),
    });
    if (res.ok) {
      setPayments(prev =>
        prev.map(p =>
          p.id === paymentId
            ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' }
            : p
        )
      );
    }
    setActionLoading(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Access denied.</p>
      </div>
    );
  }

  const pending = payments.filter(p => p.status === 'pending');
  const reviewed = payments.filter(p => p.status !== 'pending');

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Payment Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verify each transaction ID in your EasyPaisa app, then approve or reject.
          </p>
        </div>

        {pending.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 mb-6">
            No pending payments — you&apos;re all caught up.
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-3 mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending ({pending.length})
            </h2>
            {pending.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-orange-200 shadow-sm p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.user_email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Transaction ID:{' '}
                    <span className="font-mono font-medium text-gray-800">{p.transaction_id}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    PKR {p.amount_pkr.toLocaleString()} &middot;{' '}
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(p.id, 'approve')}
                    disabled={actionLoading !== null}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    {actionLoading === p.id + 'approve' ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'reject')}
                    disabled={actionLoading !== null}
                    className="bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-red-700 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
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
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Reviewed
            </h2>
            {reviewed.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.user_email}</p>
                  <p className="text-xs text-gray-500">
                    Transaction ID: <span className="font-mono">{p.transaction_id}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    PKR {p.amount_pkr.toLocaleString()} &middot;{' '}
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${
                    p.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {p.status === 'approved' ? '✓ Approved' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
