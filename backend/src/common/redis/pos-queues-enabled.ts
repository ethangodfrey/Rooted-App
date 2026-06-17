import type { ConfigService } from '@nestjs/config';

/** Whether BullMQ POS workers/queues are active (requires Redis). */
export function isPosQueuesEnabled(config: ConfigService): boolean {
  const raw = config.get<string>('POS_QUEUES_ENABLED');
  if (raw !== undefined && raw.trim() !== '') {
    return raw.toLowerCase() === 'true';
  }
  // Local dev defaults off — avoids burning Upstash quota and spam when Redis is down.
  return config.get<string>('NODE_ENV') === 'production';
}

/** Sync check for module imports during bootstrap (before ConfigService exists). */
export function isPosQueuesEnabledFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.POS_QUEUES_ENABLED;
  if (raw !== undefined && raw.trim() !== '') {
    return raw.toLowerCase() === 'true';
  }
  return env.NODE_ENV === 'production';
}
