import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { isPosQueuesEnabledFromEnv } from '../../common/redis/pos-queues-enabled';

import { CloverAdapter } from './adapters/clover/clover.adapter';
import { SquareAdapter } from './adapters/square/square.adapter';
import { ToastAdapter } from './adapters/toast/toast.adapter';
import { AdminPosController } from './controllers/admin-pos.controller';
import { AdminSimulateSwipeController } from './controllers/admin-simulate-swipe.controller';
import { PosActivityController } from './controllers/pos-activity.controller';
import { PosAnalyticsWebhooksController } from './controllers/pos-analytics-webhooks.controller';
import { PosConnectionsController } from './controllers/pos-connections.controller';
import { PosMappingsController } from './controllers/pos-mappings.controller';
import { PosOAuthController } from './controllers/pos-oauth.controller';
import { PosSyncController } from './controllers/pos-sync.controller';
import { PosWebhooksController } from './controllers/pos-webhooks.controller';
import { PosAggregationProcessor } from './jobs/pos-aggregation.processor';
import { PosInventoryFlushProcessor, PosInventoryIngestProcessor } from './jobs/pos-inventory.processor';
import { PosInventoryJobsService } from './jobs/pos-inventory-jobs.service';
import {
  POS_INVENTORY_FLUSH_QUEUE,
  POS_INVENTORY_INGEST_QUEUE,
} from './jobs/pos-inventory-queue.constants';
import { PosJobsService } from './jobs/pos-jobs.service';
import { POS_AGGREGATION_QUEUE, POS_SYNC_QUEUE } from './jobs/pos-queue.constants';
import { PosSalesIngestProcessor } from './jobs/pos-sales-ingest.processor';
import { PosSalesJobsService } from './jobs/pos-sales-jobs.service';
import { POS_SALES_INGEST_QUEUE, POS_SNAPSHOT_ROLLUP_QUEUE } from './jobs/pos-sales-queue.constants';
import { PosSnapshotRollupProcessor } from './processors/pos-snapshot-rollup.processor';
import { PosSchedulerService } from './jobs/pos-scheduler.service';
import { PosSyncProcessor } from './jobs/pos-sync.processor';
import { PosAnalyticsService } from './services/pos-analytics.service';
import { PosAnalyticsIngestService } from './services/pos-analytics-ingest.service';
import { PosAnalyticsSalesService } from './services/pos-analytics-sales.service';
import { PosActivityDashboardService } from './services/pos-activity-dashboard.service';
import { PosConnectionService } from './services/pos-connection.service';
import { PosImportService } from './services/pos-import.service';
import { PosInventorySyncService } from './services/pos-inventory-sync.service';
import { PosLedgerWriterService } from './services/pos-ledger-writer.service';
import { PosMappingService } from './services/pos-mapping.service';
import { PosMarketResolverService } from './services/pos-market-resolver.service';
import { PosSalesIngestService } from './services/pos-sales-ingest.service';
import { PosSnapshotRollupService } from './services/pos-snapshot-rollup.service';
import { PosSyncService } from './services/pos-sync.service';
import { AdminSimulateSwipeService } from './services/admin-simulate-swipe.service';
import { PosAnalyticsWebhookService } from './services/pos-analytics-webhook.service';
import { PosWebhookService } from './services/pos-webhook.service';
import { ProviderRegistryService } from './services/provider-registry.service';

const posQueuesEnabled = isPosQueuesEnabledFromEnv();

@Module({
  imports: [
    ...(posQueuesEnabled
      ? [
          BullModule.registerQueue(
            { name: POS_SYNC_QUEUE },
            { name: POS_AGGREGATION_QUEUE },
            { name: POS_INVENTORY_INGEST_QUEUE },
            { name: POS_INVENTORY_FLUSH_QUEUE },
            { name: POS_SALES_INGEST_QUEUE },
            { name: POS_SNAPSHOT_ROLLUP_QUEUE },
          ),
        ]
      : []),
  ],
  controllers: [
    PosConnectionsController,
    PosSyncController,
    PosMappingsController,
    PosOAuthController,
    PosWebhooksController,
    PosAnalyticsWebhooksController,
    PosActivityController,
    AdminPosController,
    AdminSimulateSwipeController,
  ],
  providers: [
    // Provider adapters
    SquareAdapter,
    ToastAdapter,
    CloverAdapter,
    ProviderRegistryService,
    PosAnalyticsWebhookService,
    AdminSimulateSwipeService,
    // Core services
    PosConnectionService,
    PosSyncService,
    PosImportService,
    PosMappingService,
    PosInventorySyncService,
    PosWebhookService,
    PosAnalyticsService,
    PosActivityDashboardService,
    PosLedgerWriterService,
    PosAnalyticsIngestService,
    PosAnalyticsSalesService,
    PosMarketResolverService,
    PosSalesIngestService,
    PosSnapshotRollupService,
    // Jobs
    PosJobsService,
    PosInventoryJobsService,
    PosSalesJobsService,
    ...(posQueuesEnabled
      ? [
          PosSyncProcessor,
          PosAggregationProcessor,
          PosInventoryIngestProcessor,
          PosInventoryFlushProcessor,
          PosSalesIngestProcessor,
          PosSnapshotRollupProcessor,
        ]
      : []),
    PosSchedulerService,
  ],
})
export class PosModule {}
