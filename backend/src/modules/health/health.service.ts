import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { isPosQueuesEnabled } from '../../common/redis/pos-queues-enabled';
import { describeDatabaseTarget } from '../../prisma/normalize-database-url';
import { PrismaService } from '../../prisma/prisma.service';
import { POS_SYNC_QUEUE } from '../pos/jobs/pos-queue.constants';

export interface ReadinessResult {
  ok: boolean;
  db: 'up' | 'down';
  redis: 'up' | 'down' | 'skipped';
  /** Redacted host:port/db — never includes credentials. */
  dbTarget?: string | null;
  /** Safe Prisma/pg error snippet when db is down (no secrets). */
  dbError?: string | null;
}

const DB_CHECK_TIMEOUT_MS = 10_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() @InjectQueue(POS_SYNC_QUEUE) private readonly queue: Queue | null,
  ) {}

  async readiness(): Promise<ReadinessResult> {
    const queuesEnabled = isPosQueuesEnabled(this.config);
    const dbTarget = describeDatabaseTarget(this.config.get<string>('DATABASE_URL'));

    const [dbResult, redis] = await Promise.all([
      this.checkDb(),
      queuesEnabled ? this.checkRedis() : Promise.resolve<'skipped'>('skipped'),
    ]);

    const redisOk = redis === 'up' || redis === 'skipped';
    return {
      ok: dbResult.ok && redisOk,
      db: dbResult.ok ? 'up' : 'down',
      redis,
      dbTarget,
      dbError: dbResult.ok ? null : dbResult.error,
    };
  }

  private async checkDb(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.withTimeout(async () => {
        await this.prisma.ensureConnected();
        await this.prisma.$queryRaw`SELECT 1`;
      }, DB_CHECK_TIMEOUT_MS);
      return { ok: true };
    } catch (err) {
      const message = (err as Error).message || 'unknown_db_error';
      this.logger.warn(`Health check 'db' failed: ${message}`);
      return { ok: false, error: sanitizeDbError(message) };
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    if (!this.queue) return 'down';
    try {
      await this.withTimeout(async () => {
        const client = (await this.queue!.client) as unknown as {
          ping: () => Promise<string>;
        };
        const pong = await client.ping();
        if (pong !== 'PONG') throw new Error(`unexpected redis ping: ${pong}`);
      }, 5_000);
      return 'up';
    } catch (err) {
      this.logger.debug(`Health check 'redis' failed: ${(err as Error).message}`);
      return 'down';
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function sanitizeDbError(message: string): string {
  return message
    .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/password=\S+/gi, 'password=***')
    .slice(0, 240);
}
