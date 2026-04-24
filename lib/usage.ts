import { getServiceClient } from './supabase-server';
import type { Profile } from '@/types';

export const DAILY_LIMIT_FREE = 3;
export const DAILY_LIMIT_PAID = 5;
export const MONTHLY_LIMIT_PAID = 150;

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
