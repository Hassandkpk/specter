import { Redis } from '@upstash/redis';

const DAILY_LIMIT = 10;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  // If Upstash isn't configured (local dev), allow all requests
  if (!redis) return { allowed: true, remaining: DAILY_LIMIT };

  const today = new Date().toISOString().slice(0, 10);
  const key = `searches:${ip}:${today}`;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 86400);

  return {
    allowed: count <= DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - count),
  };
}
