type EnvRecord = Record<string, string | undefined>;

export type RedisTlsOption = Record<string, never> | { rejectUnauthorized?: boolean };

/**
 * Shared ioredis / BullMQ connection fields resolved from Railway-native env.
 * Prefer REDIS_URL (`redis://` private or `rediss://` TLS); fall back to host/port.
 */
export type RedisConnectionFields = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: RedisTlsOption;
  /** BullMQ workers require null; short-lived clients may use a small number. */
  maxRetriesPerRequest: number | null;
  enableOfflineQueue: boolean;
  keepAlive: number;
  connectTimeout: number;
  enableReadyCheck: boolean;
  /** Dual-stack can break Railway private DNS — prefer IPv4 for *.railway.internal. */
  family?: number;
  retryStrategy: (times: number) => number | null;
};

export type ResolvedRedisConnection = {
  fields: RedisConnectionFields;
  source:
    | 'REDIS_URL'
    | 'REDIS_HOST'
    | 'REDISHOST'
    | 'MISSING';
  protocol: 'redis:' | 'rediss:' | 'none';
  isRailwayHost: boolean;
};

function firstPresent(env: EnvRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function isRailwayRedisHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.endsWith('.railway.internal') ||
    h.endsWith('.railway.app') ||
    h.includes('.rlwy.net') ||
    h === 'redis.railway.internal'
  );
}

function defaultRetryStrategy(times: number): number | null {
  // Persist through brief Railway private-network blips.
  if (times > 20) return null;
  return Math.min(times * 250, 5_000);
}

function decodeAuth(value: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export type ResolveRedisOptions = {
  /** Override maxRetriesPerRequest (BullMQ needs null). */
  maxRetriesPerRequest?: number | null;
  enableOfflineQueue?: boolean;
};

/**
 * Resolve Redis connection exclusively from process env:
 * REDIS_URL, or REDIS_HOST/REDIS_PORT (+ Railway aliases REDISHOST/REDISPORT).
 */
export function resolveRedisConnectionFromEnv(
  env: EnvRecord = process.env as EnvRecord,
  options: ResolveRedisOptions = {},
): ResolvedRedisConnection | null {
  const maxRetriesPerRequest =
    options.maxRetriesPerRequest === undefined ? null : options.maxRetriesPerRequest;
  const enableOfflineQueue = options.enableOfflineQueue ?? false;

  const url = firstPresent(env, ['REDIS_URL']);
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const protocol =
      parsed.protocol === 'rediss:' || parsed.protocol === 'redis:'
        ? parsed.protocol
        : null;
    if (!protocol) return null;

    const host = parsed.hostname;
    if (!host) return null;

    const pathDb = parsed.pathname?.replace(/^\//, '');
    const db =
      pathDb && /^\d+$/.test(pathDb) ? Number(pathDb) : undefined;

    const railway = isRailwayRedisHost(host);
    const fields: RedisConnectionFields = {
      host,
      port: Number(parsed.port) || 6379,
      username: decodeAuth(parsed.username),
      password: decodeAuth(parsed.password),
      ...(db !== undefined ? { db } : {}),
      ...(protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest,
      enableOfflineQueue,
      keepAlive: 30_000,
      connectTimeout: 10_000,
      enableReadyCheck: true,
      ...(railway ? { family: 4 } : {}),
      retryStrategy: defaultRetryStrategy,
    };

    return {
      fields,
      source: 'REDIS_URL',
      protocol,
      isRailwayHost: railway,
    };
  }

  const host = firstPresent(env, ['REDIS_HOST', 'REDISHOST']);
  if (!host) {
    return {
      fields: {
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest,
        enableOfflineQueue,
        keepAlive: 30_000,
        connectTimeout: 10_000,
        enableReadyCheck: true,
        retryStrategy: defaultRetryStrategy,
      },
      source: 'MISSING',
      protocol: 'none',
      isRailwayHost: false,
    };
  }

  const portRaw = firstPresent(env, ['REDIS_PORT', 'REDISPORT']) ?? '6379';
  const password = firstPresent(env, ['REDIS_PASSWORD', 'REDISPASSWORD']);
  const username = firstPresent(env, ['REDIS_USERNAME', 'REDISUSER']);
  const tlsFlag = (firstPresent(env, ['REDIS_TLS']) ?? 'false').toLowerCase() === 'true';
  const railway = isRailwayRedisHost(host);
  const source = env.REDIS_HOST?.trim() ? 'REDIS_HOST' : 'REDISHOST';

  return {
    fields: {
      host,
      port: Number(portRaw) || 6379,
      username,
      password,
      ...(tlsFlag ? { tls: {} } : {}),
      maxRetriesPerRequest,
      enableOfflineQueue,
      keepAlive: 30_000,
      connectTimeout: 10_000,
      enableReadyCheck: true,
      ...(railway ? { family: 4 } : {}),
      retryStrategy: defaultRetryStrategy,
    },
    source,
    protocol: tlsFlag ? 'rediss:' : 'redis:',
    isRailwayHost: railway,
  };
}

/** True when REDIS_URL or host/port env is present (not the localhost MISSING stub). */
export function isRedisConfigured(env: EnvRecord = process.env as EnvRecord): boolean {
  if (firstPresent(env, ['REDIS_URL'])) return true;
  if (firstPresent(env, ['REDIS_HOST', 'REDISHOST'])) return true;
  return false;
}
