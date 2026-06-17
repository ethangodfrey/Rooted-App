import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { isPosQueuesEnabledFromEnv } from '../../common/redis/pos-queues-enabled';

import { CloverAdapter } from './adapters/clover/clover.adapter';
import { SquareAdapter } from './adapters/square/square.adapter';
import { ToastAdapter } from './adapters/toast/toast.adapter';
import { AdminPosController } from './controllers/admin-pos.controller';
import { PosConnectionsController } from './controllers/pos-connections.controller';
import { PosMappingsController } from './controllers/pos-mappings.controller';
import { PosOAuthController } from './controllers/pos-oauth.controller';
import { PosSyncController } from './controllers/pos-sync.controller';
import { PosWebhooksController } from './controllers/pos-webhooks.controller';
import { PosAggregationProcessor } from './jobs/pos-aggregation.processor';
import { PosJobsService } from './jobs/pos-jobs.service';
import { POS_AGGREGATION_QUEUE, POS_SYNC_QUEUE } from './jobs/pos-queue.constants';
import { PosSchedulerService } from './jobs/pos-scheduler.service';
import { PosSyncProcessor } from './jobs/pos-sync.processor';
import { PosAnalyticsService } from './services/pos-analytics.service';
import { PosConnectionService } from './services/pos-connection.service';
import { PosImportService } from './services/pos-import.service';
import { PosMappingService } from './services/pos-mapping.service';
import { PosSyncService } from './services/pos-sync.service';
import { PosWebhookService } from './services/pos-webhook.service';
import { ProviderRegistryService } from './services/provider-registry.service';

const posQueuesEnabled = isPosQueuesEnabledFromEnv();

@Module({
  imports: [
    ...(posQueuesEnabled
      ? [BullModule.registerQueue({ name: POS_SYNC_QUEUE }, { name: POS_AGGREGATION_QUEUE })]
      : []),
  ],
  controllers: [
    PosConnectionsController,
    PosSyncController,
    PosMappingsController,
    PosOAuthController,
    PosWebhooksController,
    AdminPosController,
  ],
  providers: [
    // Provider adapters
    SquareAdapter,
    ToastAdapter,
    CloverAdapter,
    ProviderRegistryService,
    // Core services
    PosConnectionService,
    PosSyncService,
    PosImportService,
    PosMappingService,
    PosWebhookService,
    PosAnalyticsService,
    // Jobs
    PosJobsService,
    ...(posQueuesEnabled ? [PosSyncProcessor, PosAggregationProcessor] : []),
    PosSchedulerService,
  ],
})
export class PosModule {}
