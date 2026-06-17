import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type Job } from 'bullmq';

import { isPosQueuesEnabled } from '../../../common/redis/pos-queues-enabled';
import { PosAnalyticsService } from '../services/pos-analytics.service';
import { PosSyncService } from '../services/pos-sync.service';
import {
  POS_AGGREGATION_QUEUE,
  POS_JOBS,
  POS_SYNC_QUEUE,
  type AggregateVendorJobData,
  type SyncConnectionJobData,
} from './pos-queue.constants';

@Injectable()
export class PosJobsService {
  private readonly logger = new Logger(PosJobsService.name);
  private readonly queuesEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectQueue(POS_SYNC_QUEUE) private readonly syncQueue: Queue | null,
    @Optional()
    @InjectQueue(POS_AGGREGATION_QUEUE)
    private readonly aggregationQueue: Queue | null,
    @Inject(forwardRef(() => PosSyncService)) private readonly sync: PosSyncService,
    @Inject(forwardRef(() => PosAnalyticsService))
    private readonly analytics: PosAnalyticsService,
  ) {
    this.queuesEnabled = isPosQueuesEnabled(config);
    if (!this.queuesEnabled) {
      this.logger.warn(
        'POS job queues disabled — sync/aggregation run inline in this process (set POS_QUEUES_ENABLED=true + Redis for production workers).',
      );
    }
  }

  enqueueSync(data: SyncConnectionJobData): Promise<Job<SyncConnectionJobData>> {
    if (!this.queuesEnabled || !this.syncQueue) {
      void this.sync.runSync(data).catch((err: Error) => {
        this.logger.error(`Inline POS sync failed for ${data.connectionId}: ${err.message}`);
      });
      return Promise.resolve({ id: data.syncRunId } as Job<SyncConnectionJobData>);
    }

    return this.syncQueue.add(POS_JOBS.SYNC_CONNECTION, data, {
      jobId: data.syncRunId,
    });
  }

  enqueueAggregation(data: AggregateVendorJobData): Promise<Job<AggregateVendorJobData>> {
    if (!this.queuesEnabled || !this.aggregationQueue) {
      void this.analytics.recomputeSnapshots(data.vendorId, data.dates).catch((err: Error) => {
        this.logger.error(`Inline POS aggregation failed for ${data.vendorId}: ${err.message}`);
      });
      return Promise.resolve({ id: `inline-${Date.now()}` } as Job<AggregateVendorJobData>);
    }

    return this.aggregationQueue.add(POS_JOBS.AGGREGATE_VENDOR, data);
  }
}
