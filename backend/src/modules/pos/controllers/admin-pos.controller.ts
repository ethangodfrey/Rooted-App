import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
  Get,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PosConnectionStatus, PosProvider } from '@prisma/client';
import { Queue } from 'bullmq';

import { Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { isPosQueuesEnabled } from '../../../common/redis/pos-queues-enabled';
import { PrismaService } from '../../../prisma/prisma.service';
import { POS_AGGREGATION_QUEUE, POS_SYNC_QUEUE } from '../jobs/pos-queue.constants';
import { PosSyncService } from '../services/pos-sync.service';

/** Internal admin operations across all vendors' POS connections. */
@Controller('admin/pos')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: PosSyncService,
    private readonly config: ConfigService,
    @Optional() @InjectQueue(POS_SYNC_QUEUE) private readonly syncQueue: Queue | null,
    @Optional()
    @InjectQueue(POS_AGGREGATION_QUEUE)
    private readonly aggregationQueue: Queue | null,
  ) {}

  @Get('connections')
  connections(
    @Query('provider') provider?: PosProvider,
    @Query('status') status?: PosConnectionStatus,
  ) {
    return this.prisma.posConnection.findMany({
      where: { provider, status },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { transactions: true, errors: true, syncRuns: true } } },
    });
  }

  @Get('sync-runs')
  syncRuns(@Query('connectionId', new ParseUUIDPipe({ optional: true })) connectionId?: string) {
    return this.prisma.posSyncRun.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('errors')
  errors(@Query('connectionId', new ParseUUIDPipe({ optional: true })) connectionId?: string) {
    return this.prisma.posSyncError.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Force an immediate backfill sync for any connection (support tooling). */
  @Post('connections/:id/resync')
  async resync(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.sync.queueSync(id, 'BACKFILL');
    return { syncRunId: run.id, status: run.status };
  }

  // --- Queue observability ---

  /** Job counts (waiting/active/completed/failed/delayed) per POS queue. */
  @Get('queues')
  async queues() {
    this.requireQueues();
    const [sync, aggregation] = await Promise.all([
      this.syncQueue!.getJobCounts(),
      this.aggregationQueue!.getJobCounts(),
    ]);
    return { [POS_SYNC_QUEUE]: sync, [POS_AGGREGATION_QUEUE]: aggregation };
  }

  /** Recent failed jobs on a queue, for triage. */
  @Get('queues/:name/failed')
  async failedJobs(@Param('name') name: string) {
    const queue = this.resolveQueue(name);
    const jobs = await queue.getFailed(0, 49);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      data: job.data,
    }));
  }

  /** Re-enqueue all failed jobs on a queue (e.g. after fixing a provider issue). */
  @Post('queues/:name/retry')
  async retryFailed(@Param('name') name: string) {
    const queue = this.resolveQueue(name);
    const jobs = await queue.getFailed(0, 999);
    let retried = 0;
    for (const job of jobs) {
      try {
        await job.retry();
        retried += 1;
      } catch {
        // Job may have been removed/locked concurrently; skip it.
      }
    }
    return { queue: name, retried, failed: jobs.length };
  }

  private resolveQueue(name: string): Queue {
    this.requireQueues();
    if (name === POS_SYNC_QUEUE) return this.syncQueue!;
    if (name === POS_AGGREGATION_QUEUE) return this.aggregationQueue!;
    throw new BadRequestException(`Unknown queue: ${name}`);
  }

  private requireQueues(): void {
    if (!isPosQueuesEnabled(this.config) || !this.syncQueue || !this.aggregationQueue) {
      throw new ServiceUnavailableException(
        'POS job queues are disabled (POS_QUEUES_ENABLED=false). Sync still runs inline on API triggers.',
      );
    }
  }
}
