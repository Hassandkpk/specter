import { getServiceClient } from './supabase-server';
import type { Profile } from '@/types';

export const DAILY_LIMIT_FREE = 3;
export const DAILY_LIMIT_PAID = 5;
export const MONTHLY_LIMIT_PAID = 150;

export const FREE_CREDITS = 500;
export const PAID_CREDITS_MONTHLY = 10_000;
export const CREDIT_PER_REMIX = 10;
export const CREDIT_PER_OWN_VIDEO = 5;

export function calcGenerateCost(numRemixes: number, numOwnVideos: number): number {
  return numRemixes * CREDIT_PER_REMIX + numOwnVideos * CREDIT_PER_OWN_VIDEO;
}

export async function initializeCredits(userId: string, ip: string): Promise<void> {
  const supabase = getServiceClient();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, credits, signup_ip, credits_reset_month, banned')
    .eq('id', userId)
    .single();

  if (!profile || profile.banned) return;

  if (profile.plan === 'paid') {
    if (profile.credits_reset_month !== thisMonth) {
      await supabase
        .from('profiles')
        .update({ credits: PAID_CREDITS_MONTHLY, credits_reset_month: thisMonth })
        .eq('id', userId);
    }
    return;
  }

  // Free users: only initialize once (signup_ip === null means never done)
  if (profile.signup_ip !== null) return;

  const { error: claimError } = await supabase
    .from('ip_free_claims')
    .insert({ ip, user_id: userId });

  // 23505 = unique_violation — another account from this IP already claimed
  const ipAlreadyClaimed = claimError?.code === '23505';
  await supabase
    .from('profiles')
    .update({ credits: ipAlreadyClaimed ? 0 : FREE_CREDITS, signup_ip: ip })
    .eq('id', userId);
}

export async function deductCredits(
  userId: string,
  cost: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = getServiceClient();
  const { data } = await supabase.rpc('deduct_credits', { p_user_id: userId, p_cost: cost });

  if (data === null || data === undefined) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    return { allowed: false, remaining: profile?.credits ?? 0 };
  }

  return { allowed: true, remaining: data as number };
}

export async function getUserFromToken(token: string) {
  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function checkAndIncrementUsage(
  userId: string
): Promise<{ allowed: boolean; reason?: string; profile?: Profile }> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) return { allowed: false, reason: 'Profile not found' };

  if (profile.banned) return { allowed: false, reason: 'Your account has been suspended.', profile: profile as Profile };

  const dailyLimit = profile.plan === 'paid' ? DAILY_LIMIT_PAID : DAILY_LIMIT_FREE;
  const dailyRuns = profile.last_run_date === today ? profile.daily_runs : 0;
  const monthlyRuns = profile.last_run_month === thisMonth ? profile.monthly_runs : 0;

  if (dailyRuns >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyLimit}/day on ${profile.plan} plan). Come back tomorrow.`,
      profile: profile as Profile,
    };
  }

  if (profile.plan === 'paid' && monthlyRuns >= MONTHLY_LIMIT_PAID) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${MONTHLY_LIMIT_PAID}/month). Resets next month.`,
      profile: profile as Profile,
    };
  }

  const updated = {
    daily_runs: dailyRuns + 1,
    monthly_runs: monthlyRuns + 1,
    last_run_date: today,
    last_run_month: thisMonth,
  };

  await supabase.from('profiles').update(updated).eq('id', userId);

  return {
    allowed: true,
    profile: { ...profile, ...updated } as Profile,
  };
}
