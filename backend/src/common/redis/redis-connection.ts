import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import {
  isRedisConfigured,
  resolveRedisConnectionFromEnv,
  type RedisConnectionFields,
  type ResolvedRedisConnection,
} from '@vendorly/env-config';
import type { RedisOptions } from 'ioredis';

let loggedMigration = false;

function logMigrationConfigured(resolved: ResolvedRedisConnection): void {
  if (loggedMigration) return;
  loggedMigration = true;
  const { fields, source, protocol, isRailwayHost } = resolved;
  // eslint-disable-next-line no-console
  console.log(
    `REDIS_MIGRATION_CONFIGURED SOURCE=${source} PROTOCOL=${protocol} HOST=${fields.host} PORT=${fields.port} RAILWAY=${isRailwayHost ? '1' : '0'}`,
  );
}

function fieldsToBullmq(fields: RedisConnectionFields): ConnectionOptions {
  return {
    host: fields.host,
    port: fields.port,
    username: fields.username,
    password: fields.password,
    db: fields.db,
    ...(fields.tls ? { tls: fields.tls } : {}),
    maxRetriesPerRequest: fields.maxRetriesPerRequest,
    enableOfflineQueue: fields.enableOfflineQueue,
    keepAlive: fields.keepAlive,
    connectTimeout: fields.connectTimeout,
    enableReadyCheck: fields.enableReadyCheck,
    ...(fields.family ? { family: fields.family } : {}),
    retryStrategy: fields.retryStrategy,
  };
}

function fieldsToIoredis(fields: RedisConnectionFields): RedisOptions {
  return {
    host: fields.host,
    port: fields.port,
    username: fields.username,
    password: fields.password,
    db: fields.db,
    ...(fields.tls ? { tls: fields.tls } : {}),
    maxRetriesPerRequest:
      fields.maxRetriesPerRequest === null ? 2 : fields.maxRetriesPerRequest,
    enableOfflineQueue: fields.enableOfflineQueue,
    keepAlive: fields.keepAlive,
    connectTimeout: fields.connectTimeout,
    enableReadyCheck: fields.enableReadyCheck,
    ...(fields.family ? { family: fields.family } : {}),
    retryStrategy: fields.retryStrategy,
    lazyConnect: true,
  };
}

function envFromConfig(config: ConfigService): NodeJS.ProcessEnv {
  return {
    REDIS_URL: config.get<string>('REDIS_URL'),
    REDIS_HOST: config.get<string>('REDIS_HOST'),
    REDISHOST: config.get<string>('REDISHOST'),
    REDIS_PORT: config.get<string>('REDIS_PORT'),
    REDISPORT: config.get<string>('REDISPORT'),
    REDIS_PASSWORD: config.get<string>('REDIS_PASSWORD'),
    REDISPASSWORD: config.get<string>('REDISPASSWORD'),
    REDIS_USERNAME: config.get<string>('REDIS_USERNAME'),
    REDISUSER: config.get<string>('REDISUSER'),
    REDIS_TLS: config.get<string>('REDIS_TLS'),
  };
}

/**
 * Resolves BullMQ connection settings for Railway-native Redis.
 * Prefer REDIS_URL (`redis://` private network or `rediss://` TLS);
 * falls back to REDIS_HOST / REDIS_PORT (and Railway REDISHOST / REDISPORT).
 */
export function resolveRedisConnection(config: ConfigService): ConnectionOptions {
  const resolved = resolveRedisConnectionFromEnv(envFromConfig(config), {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  if (!resolved || resolved.source === 'MISSING') {
    // Preserve prior default: localhost when no env is set (local BullMQ bootstrap).
    const fallback = resolveRedisConnectionFromEnv(
      { REDIS_HOST: 'localhost', REDIS_PORT: '6379' },
      { maxRetriesPerRequest: null, enableOfflineQueue: false },
    )!;
    logMigrationConfigured(fallback);
    return fieldsToBullmq(fallback.fields);
  }
  logMigrationConfigured(resolved);
  return fieldsToBullmq(resolved.fields);
}

/**
 * ioredis options for cache / coalesce clients (short maxRetriesPerRequest).
 * Returns null when Redis is not configured.
 */
export function resolveIoredisOptions(config: ConfigService): RedisOptions | null {
  if (!isRedisConfigured(envFromConfig(config))) {
    return null;
  }
  const resolved = resolveRedisConnectionFromEnv(envFromConfig(config), {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  if (!resolved || resolved.source === 'MISSING') return null;
  logMigrationConfigured(resolved);
  return fieldsToIoredis(resolved.fields);
}

/** Attach ready/error logs for an ioredis client (no emojis). */
export function attachRailwayRedisLogs(
  redis: {
    on: (event: string, listener: (...args: unknown[]) => void) => unknown;
    options?: { host?: string };
  },
  label = 'REDIS',
): void {
  redis.on('ready', () => {
    const host = redis.options?.host ?? 'unknown';
    // eslint-disable-next-line no-console
    console.log(`RAILWAY_REDIS_CONNECTED LABEL=${label} HOST=${host}`);
  });
  redis.on('error', (...args: unknown[]) => {
    const err = args[0];
    const message = err instanceof Error ? err.message : String(err ?? 'UNKNOWN');
    // eslint-disable-next-line no-console
    console.log(`REDIS_CONNECTION_ERROR LABEL=${label} MESSAGE=${message.slice(0, 180)}`);
  });
}

/** Test helper — allow re-logging after env changes in unit tests. */
export function resetRedisMigrationLogFlag(): void {
  loggedMigration = false;
}
