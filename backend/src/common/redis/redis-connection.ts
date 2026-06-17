import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

/**
 * Resolves BullMQ/ioredis connection settings.
 * Prefer REDIS_URL (paste the TCP line from Upstash as-is); falls back to
 * discrete REDIS_HOST / REDIS_PORT / REDIS_USERNAME / REDIS_PASSWORD vars.
 */
export function resolveRedisConnection(config: ConfigService): ConnectionOptions {
  const url = config.get<string>('REDIS_URL')?.trim();
  const shared: Partial<ConnectionOptions> = {
    // Required by BullMQ; also avoids infinite offline command queue growth.
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 300, 3_000);
    },
  };

  if (url) {
    const parsed = new URL(url);
    return {
      ...shared,
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      username: decodeURIComponent(parsed.username) || undefined,
      password: decodeURIComponent(parsed.password) || undefined,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  }

  const tls = config.get<string>('REDIS_TLS', 'false') === 'true';
  return {
    ...shared,
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: Number(config.get<string>('REDIS_PORT', '6379')),
    username: config.get<string>('REDIS_USERNAME') || undefined,
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    ...(tls ? { tls: {} } : {}),
  };
}
