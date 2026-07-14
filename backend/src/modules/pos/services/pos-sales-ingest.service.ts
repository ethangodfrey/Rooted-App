/**
 * Core sales webhook ingest — shared by BullMQ processor and inline fallback.
 * Writes pos_transactions (ledger) + analytics_sales (Phase 45) + schedules rollups.
 */

import { Injectable, Logger } from '@nestjs/common';

import { buildSnapshotRollupJobs } from '../utils/tender-aggregation';
import { PosAnalyticsSalesService } from './pos-analytics-sales.service';
import { PosLedgerWriterService } from './pos-ledger-writer.service';
import { PosMarketResolverService } from './pos-market-resolver.service';
import type { PosSalesIngestJobData, PosSnapshotRollupJobData } from '../types/ledger-transaction';

export interface PosSalesIngestResult {
  written: number;
  analyticsWritten: number;
  rollups: PosSnapshotRollupJobData[];
}

@Injectable()
export class PosSalesIngestService {
  private readonly logger = new Logger(PosSalesIngestService.name);

  constructor(
    private readonly ledger: PosLedgerWriterService,
    private readonly analytics: PosAnalyticsSalesService,
    private readonly marketResolver: PosMarketResolverService,
  ) {}

  async ingest(data: PosSalesIngestJobData): Promise<PosSalesIngestResult> {
    const connection = await this.marketResolver.resolveConnection(
      data.provider,
      data.providerMerchantId,
      data.providerLocationId,
    );

    if (!connection) {
      this.logger.warn(
        `No active vendor_pos_connections for ${data.provider} event ${data.providerEventId}`,
      );
      return { written: 0, analyticsWritten: 0, rollups: [] };
    }

    let written = 0;
    let analyticsWritten = 0;

    for (const txn of data.transactions) {
      const result = await this.ledger.upsertTransaction({
        vendorId: connection.vendorId,
        connectionId: connection.id,
        provider: data.provider,
        externalTransactionId: txn.externalTransactionId,
        grossAmount: txn.grossAmountCents,
        platformFee: txn.platformFeeCents,
        currency: txn.currency,
        soldAt: txn.soldAt,
        rawPayload: txn.rawPayload,
      });
      if (result?.id) written += 1;

      const sale = await this.analytics.upsertSale({
        vendorId: connection.vendorId,
        tenantId: connection.tenantId,
        connectionId: connection.id,
        webhookLogId: data.webhookLogId,
        provider: data.provider,
        externalTransactionId: txn.externalTransactionId,
        providerLocationId: txn.providerLocationId ?? data.providerLocationId,
        providerOrderId: txn.providerOrderId,
        status: txn.state,
        currency: txn.currency,
        grossSalesCents: txn.grossAmountCents,
        taxCents: txn.taxCents ?? 0,
        processingFeeCents: txn.processingFeeCents ?? 0,
        platformFeeCents: txn.platformFeeCents,
        soldAt: txn.soldAt,
        tenderType: txn.tenderType,
        metadata: {
          cardBrand: txn.cardBrand ?? null,
          providerEventId: data.providerEventId,
        },
      });
      if (sale?.id) analyticsWritten += 1;
    }

    const market = await this.marketResolver.resolveMarketForVendor(
      connection.vendorId,
      data.providerLocationId,
    );

    if (!market) {
      this.logger.debug(
        `Sales ingest wrote ledger=${written} analytics=${analyticsWritten} vendor=${connection.vendorId} (no approved market)`,
      );
      return { written, analyticsWritten, rollups: [] };
    }

    const rollups = buildSnapshotRollupJobs({
      vendorId: connection.vendorId,
      marketId: market.marketId,
      tenantId: connection.tenantId,
      posConnectionId: connection.id,
      transactions: data.transactions,
    });

    this.logger.debug(
      `Sales ingest vendor=${connection.vendorId} market=${market.marketId} ledger=${written} analytics=${analyticsWritten} rollups=${rollups.length}`,
    );

    return { written, analyticsWritten, rollups };
  }
}
