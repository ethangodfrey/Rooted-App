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

export interface ProductionHealthProbe {
  ok: boolean;
  db: 'UP' | 'DOWN';
  supabase: 'UP' | 'DOWN';
  timestamp: number;
  reason?: string;
}

export type ApiHealthPayload = {
  STATUS: 'HEALTH_OK' | 'HEALTH_DEGRADED';
  TIMESTAMP: number;
};

const DB_CHECK_TIMEOUT_MS = 10_000;
const SUPABASE_CHECK_TIMEOUT_MS = 5_000;

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

  /**
   * Production balancer probe: Postgres SELECT 1 + Supabase auth health.
   * Returns uppercase STATUS payload for /api/health.
   */
  async productionProbe(): Promise<ProductionHealthProbe> {
    const timestamp = Math.floor(Date.now() / 1000);
    const [dbResult, supabaseOk] = await Promise.all([
      this.checkDb(),
      this.checkSupabase(),
    ]);

    const ok = dbResult.ok && supabaseOk;
    if (!ok) {
      const reason = !dbResult.ok
        ? 'DATABASE_UNREACHABLE'
        : 'SUPABASE_UNREACHABLE';
      this.logger.warn(`HEALTH_DEGRADED REASON=${reason}`);
      return {
        ok: false,
        db: dbResult.ok ? 'UP' : 'DOWN',
        supabase: supabaseOk ? 'UP' : 'DOWN',
        timestamp,
        reason,
      };
    }

    this.logger.log('HEALTH_OK');
    return {
      ok: true,
      db: 'UP',
      supabase: 'UP',
      timestamp,
    };
  }

  toApiHealthPayload(probe: ProductionHealthProbe): ApiHealthPayload {
    return {
      STATUS: probe.ok ? 'HEALTH_OK' : 'HEALTH_DEGRADED',
      TIMESTAMP: probe.timestamp,
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
      const message = (err as Error).message || 'UNKNOWN_DB_ERROR';
      this.logger.warn(`HEALTH_CHECK_DB_FAILED: ${sanitizeDbError(message)}`);
      return { ok: false, error: sanitizeDbError(message) };
    }
  }

  private async checkSupabase(): Promise<boolean> {
    const base = (this.config.get<string>('SUPABASE_URL') || '').trim().replace(/\/$/, '');
    if (!base) {
      this.logger.warn('HEALTH_CHECK_SUPABASE_FAILED: MISSING_SUPABASE_URL');
      return false;
    }

    const endpoint = `${base}/auth/v1/health`;
    const anonKey = (
      this.config.get<string>('SUPABASE_ANON_KEY') ||
      this.config.get<string>('VITE_SUPABASE_ANON_KEY') ||
      ''
    ).trim();
    try {
      await this.withTimeout(async () => {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (anonKey) {
          headers.apikey = anonKey;
          headers.Authorization = `Bearer ${anonKey}`;
        }
        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
        });
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
      }, SUPABASE_CHECK_TIMEOUT_MS);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      this.logger.warn(`HEALTH_CHECK_SUPABASE_FAILED: ${message}`);
      return false;
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
      this.logger.debug(
        `HEALTH_CHECK_REDIS_FAILED: ${(err as Error).message}`,
      );
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
