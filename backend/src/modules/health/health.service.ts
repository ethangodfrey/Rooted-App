import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { isPosQueuesEnabled } from '../../common/redis/pos-queues-enabled';
import { PrismaService } from '../../prisma/prisma.service';
import { POS_SYNC_QUEUE } from '../pos/jobs/pos-queue.constants';

export interface ReadinessResult {
  ok: boolean;
  db: 'up' | 'down';
  redis: 'up' | 'down' | 'skipped';
}

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
    const [db, redis] = await Promise.all([
      this.checkDb(),
      queuesEnabled ? this.checkRedis() : Promise.resolve<'skipped'>('skipped'),
    ]);
    const redisOk = redis === 'up' || redis === 'skipped';
    return { ok: db && redisOk, db: db ? 'up' : 'down', redis };
  }

  private async checkDb(): Promise<boolean> {
    return this.guard('db', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    });
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    if (!this.queue) return 'down';
    const ok = await this.guard('redis', async () => {
      const client = (await this.queue!.client) as unknown as {
        ping: () => Promise<string>;
      };
      const pong = await client.ping();
      return pong === 'PONG';
    });
    return ok ? 'up' : 'down';
  }

  /** Runs a check with a hard timeout so a hung/unavailable dependency can't
   *  block the health endpoint (offline command queues, etc.). */
  private async guard(name: string, fn: () => Promise<boolean>): Promise<boolean> {
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000));
    try {
      return await Promise.race([fn(), timeout]);
    } catch (err) {
      this.logger.debug(`Health check '${name}' failed: ${(err as Error).message}`);
      return false;
    }
  }
}
