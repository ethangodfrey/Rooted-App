import {
  isRedisConfigured,
  resolveRedisConnectionFromEnv,
  type RedisConnectionFields,
} from '@vendorly/env-config';
import type { ConnectionOptions } from 'bullmq';

let loggedMigration = false;

function logMigration(fields: RedisConnectionFields, source: string, protocol: string): void {
  if (loggedMigration) return;
  loggedMigration = true;
  // eslint-disable-next-line no-console
  console.log(
    `REDIS_MIGRATION_CONFIGURED SOURCE=${source} PROTOCOL=${protocol} HOST=${fields.host} PORT=${fields.port}`,
  );
}

/**
 * BullMQ connection for tenant-web producers (inventory/sales/checkout enqueue).
 * Uses Railway-native REDIS_URL (`redis://` / `rediss://`) or REDIS_HOST/PORT.
 */
export function resolveRedisConnection(): ConnectionOptions | null {
  if (!isRedisConfigured()) return null;

  const resolved = resolveRedisConnectionFromEnv(process.env, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  if (!resolved || resolved.source === 'MISSING') return null;

  logMigration(resolved.fields, resolved.source, resolved.protocol);
  const { fields } = resolved;
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
