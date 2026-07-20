import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  buildPartialIndexPriorityPlan,
  buildPartialOrderActivitySyncSql,
  elasticsearchCreatedAtRoutingKey,
  elasticsearchRoutingKey,
  formatSearchOptimizationInitializedLog,
  PARTIAL_INDEX_RECENT_MONTHS,
  type PartialIndexPriorityPlan,
} from './partition-aware-indexing.util';

export type OrderActivityIndexDocument = {
  vendorId: string;
  productId: string;
  orderLineCount: number;
  lastOrderedAt: string;
  partitionSuffix: string;
};

/**
 * Syncs order-activity signals into Elasticsearch from recent partitions only.
 * Acknowledges RANGE(created_at) structure on orders / order_items.
 */
@Injectable()
export class PartitionAwareOrderIndexerService implements OnModuleInit {
  private readonly logger = new Logger(PartitionAwareOrderIndexerService.name);
  private readonly monthsBack: number;
  private plan: PartialIndexPriorityPlan;

  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: ElasticsearchClientService,
    private readonly config: ConfigService,
  ) {
    const configured = Number(
      this.config.get<string>('DISCOVERY_PARTIAL_INDEX_MONTHS'),
    );
    this.monthsBack =
      Number.isFinite(configured) && configured >= 1
        ? Math.floor(configured)
        : PARTIAL_INDEX_RECENT_MONTHS;
    this.plan = buildPartialIndexPriorityPlan({
      monthsBack: this.monthsBack,
      routingField: 'vendor_id',
    });
  }

  onModuleInit(): void {
    this.plan = buildPartialIndexPriorityPlan({
      monthsBack: this.monthsBack,
      routingField: 'vendor_id',
    });
    this.logger.log(formatSearchOptimizationInitializedLog(this.plan));
  }

  getPriorityPlan(): PartialIndexPriorityPlan {
    return this.plan;
  }

  activityIndex(): string {
    return `${this.elastic.wholesaleIndex()}_order_activity`;
  }

  /**
   * Partial reindex: walk recent/active partitions by priority (hot first).
   * Skips network IO when Elasticsearch is disabled.
   */
  async syncRecentPartitions(options?: {
    reference?: Date;
    limitPerPartition?: number;
  }): Promise<{
    PARTITIONS_SCANNED: number;
    DOCUMENTS_INDEXED: number;
    SKIPPED_REASON: string | null;
  }> {
    this.plan = buildPartialIndexPriorityPlan({
      reference: options?.reference ?? new Date(),
      monthsBack: this.monthsBack,
      routingField: 'vendor_id',
    });

    const client = this.elastic.getClient();
    if (!client) {
      this.logger.log(
        'PARTITION_AWARE_SYNC_SKIPPED REASON=NODE_UNSET PARTIAL=1',
      );
      return {
        PARTITIONS_SCANNED: 0,
        DOCUMENTS_INDEXED: 0,
        SKIPPED_REASON: 'NODE_UNSET',
      };
    }

    const orderWindows = this.plan.windows.filter(
      (w) => w.tableName === 'orders',
    );
    let documentsIndexed = 0;

    for (const window of orderWindows) {
      const syncPlan = buildPartialOrderActivitySyncSql({
        start: window.start,
        end: window.end,
        limit: options?.limitPerPartition,
      });

      this.logger.log(
        `PARTITION_AWARE_SYNC_STARTED PARTITION=${syncPlan.partitionSuffix} PRIORITY=${window.priority} PRUNE=1`,
      );

      type ActivityRow = {
        vendor_id: string;
        product_id: string;
        order_line_count: number;
        last_ordered_at: Date;
      };

      let rows: ActivityRow[] = [];
      try {
        rows = await this.prisma.$queryRawUnsafe<ActivityRow[]>(syncPlan.sql);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `PARTITION_AWARE_SYNC_QUERY_SKIPPED PARTITION=${syncPlan.partitionSuffix} ERROR=${message}`,
        );
        continue;
      }

      for (const row of rows) {
        const doc: OrderActivityIndexDocument = {
          vendorId: row.vendor_id,
          productId: row.product_id,
          orderLineCount: Number(row.order_line_count),
          lastOrderedAt: new Date(row.last_ordered_at).toISOString(),
          partitionSuffix: syncPlan.partitionSuffix,
        };
        const indexed = await this.indexActivityDocument(doc);
        if (indexed) documentsIndexed += 1;
      }

      this.logger.log(
        `PARTITION_AWARE_SYNC_COMPLETED PARTITION=${syncPlan.partitionSuffix} ROWS=${rows.length} INDEXED=${documentsIndexed}`,
      );
    }

    return {
      PARTITIONS_SCANNED: orderWindows.length,
      DOCUMENTS_INDEXED: documentsIndexed,
      SKIPPED_REASON: null,
    };
  }

  async indexActivityDocument(
    doc: OrderActivityIndexDocument,
  ): Promise<boolean> {
    const client = this.elastic.getClient();
    if (!client) return false;

    const routing = elasticsearchRoutingKey(doc.vendorId);
    const createdAtRouting = elasticsearchCreatedAtRoutingKey(
      new Date(doc.lastOrderedAt),
    );
    const id = `${doc.vendorId}:${doc.productId}:${doc.partitionSuffix}`;

    try {
      await client.index({
        index: this.activityIndex(),
        id,
        routing,
        document: {
          vendor_id: doc.vendorId,
          product_id: doc.productId,
          order_line_count: doc.orderLineCount,
          last_ordered_at: doc.lastOrderedAt,
          partition_suffix: doc.partitionSuffix,
          created_at_routing: createdAtRouting,
        },
        refresh: false,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `PARTITION_AWARE_INDEX_FAILED ID=${id} ERROR=${message}`,
      );
      return false;
    }
  }

  /** Build parameterized prune SQL for callers that prefer Prisma.sql. */
  buildPrunedActivityQuery(start: Date, end: Date): Prisma.Sql {
    return Prisma.sql`
      SELECT
        o.vendor_id,
        oi.product_id,
        COUNT(*)::int AS order_line_count,
        MAX(o.created_at) AS last_ordered_at
      FROM public.orders o
      JOIN public.order_items oi
        ON oi.order_id = o.id
       AND oi.order_created_at = o.created_at
      WHERE o.created_at >= ${start}
        AND o.created_at < ${end}
        AND oi.created_at >= ${start}
        AND oi.created_at < ${end}
      GROUP BY o.vendor_id, oi.product_id
    `;
  }
}
