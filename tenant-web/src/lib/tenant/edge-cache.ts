import { Redis } from '@upstash/redis';

import type { TenantCacheEnvelope } from './types';
import {
  TENANT_CACHE_FRESH_MS,
  TENANT_CACHE_STALE_MS,
  tenantCacheKey,
} from './resolve-host';

type CacheFreshness = 'fresh' | 'stale' | 'expired';

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export function getEnvelopeFreshness(
  envelope: TenantCacheEnvelope,
  now = Date.now(),
): CacheFreshness {
  const age = now - envelope.fetchedAt;
  if (age <= TENANT_CACHE_FRESH_MS) return 'fresh';
  if (age <= TENANT_CACHE_STALE_MS) return 'stale';
  return 'expired';
}

export async function readTenantEnvelopeFromEdge(
  host: string,
): Promise<{ envelope: TenantCacheEnvelope; freshness: CacheFreshness } | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(tenantCacheKey(host));
    if (!raw) return null;
    const envelope =
      typeof raw === 'string' ? (JSON.parse(raw) as TenantCacheEnvelope) : (raw as TenantCacheEnvelope);
    return { envelope, freshness: getEnvelopeFreshness(envelope) };
  } catch {
    return null;
  }
}

export async function writeTenantEnvelopeToEdge(
  host: string,
  envelope: TenantCacheEnvelope,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(tenantCacheKey(host), JSON.stringify(envelope), { ex: 3600 });
  } catch {
    // Edge cache write failures must not block routing.
  }
}
