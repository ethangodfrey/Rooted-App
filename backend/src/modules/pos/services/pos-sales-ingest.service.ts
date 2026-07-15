/**
 * Core sales webhook ingest — shared by BullMQ processor and inline fallback.
 * Writes pos_transactions (ledger) + analytics_sales (Phase 45) + schedules rollups.
 */

import { Injectable, Logger } from '@nestjs/common';

import { buildSnapshotRollupJobs } from '../utils/tender-aggregation';
import type { AnalyticsPaymentStatus } from '../types/analytics-transaction';
import type { PosSalesIngestJobData, PosSnapshotRollupJobData } from '../types/ledger-transaction';
import { PosAnalyticsIngestService } from './pos-analytics-ingest.service';
import { PosAnalyticsSalesService } from './pos-analytics-sales.service';
import { PosLedgerWriterService } from './pos-ledger-writer.service';
import { PosMarketResolverService } from './pos-market-resolver.service';

export interface PosSalesIngestResult {
  written: number;
  analyticsWritten: number;
  /** Phase 47 unified analytics transaction upserts. */
  analyticsTxnWritten: number;
  rollups: PosSnapshotRollupJobData[];
}

@Injectable()
export class PosSalesIngestService {
  private readonly logger = new Logger(PosSalesIngestService.name);

  constructor(
    private readonly ledger: PosLedgerWriterService,
    private readonly analytics: PosAnalyticsSalesService,
    private readonly analyticsIngest: PosAnalyticsIngestService,
    private readonly marketResolver: PosMarketResolverService,
  ) {}

  async ingest(data: PosSalesIngestJobData): Promise<PosSalesIngestResult> {
    const connection = await this.marketResolver.resolveConnection(
      data.provider,
      data.providerMerchantId,
      data.providerLocationId,
    );

    if (!connection) {
      const msg = `No active vendor_pos_connections for ${data.provider} event ${data.providerEventId} merchant=${data.providerMerchantId ?? ''} location=${data.providerLocationId ?? ''}`;
      this.logger.warn(msg);
      // Fail the job so BullMQ retries and Redis failed list surfaces the root cause.
      throw new Error(msg);
    }

    let written = 0;
    let analyticsWritten = 0;
    let analyticsTxnWritten = 0;

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

      // Phase 47 unified analytics rows (with line items when present in raw payload).
      try {
        if (data.provider === 'square') {
          const mapped = await this.analyticsIngest.ingestSquarePayload(txn.rawPayload, {
            vendorId: connection.vendorId,
            posConnectionId: connection.id,
            provider: 'square',
          });
          if (mapped) {
            analyticsTxnWritten += 1;
          } else {
            await this.analyticsIngest.upsertTransaction({
              externalTransactionId: txn.externalTransactionId,
              vendorId: connection.vendorId,
              posConnectionId: connection.id,
              provider: data.provider,
              totalAmountCents: txn.grossAmountCents,
              taxAmountCents: txn.taxCents ?? 0,
              tipAmountCents: 0,
              currency: txn.currency,
              paymentStatus: txn.state as AnalyticsPaymentStatus,
              transactionCreatedAt: txn.soldAt,
              providerLocationId: txn.providerLocationId ?? data.providerLocationId,
              items: [],
              rawPayload: txn.rawPayload,
            });
            analyticsTxnWritten += 1;
          }
        } else {
          await this.analyticsIngest.upsertTransaction({
            externalTransactionId: txn.externalTransactionId,
            vendorId: connection.vendorId,
            posConnectionId: connection.id,
            provider: data.provider,
            totalAmountCents: txn.grossAmountCents,
            taxAmountCents: txn.taxCents ?? 0,
            tipAmountCents: 0,
            currency: txn.currency,
            paymentStatus: txn.state as AnalyticsPaymentStatus,
            transactionCreatedAt: txn.soldAt,
            providerLocationId: txn.providerLocationId ?? data.providerLocationId,
            items: [],
            rawPayload: txn.rawPayload,
          });
          analyticsTxnWritten += 1;
        }
      } catch (err) {
        // Non-fatal: ledger + analytics_sales already written; log and continue.
        this.logger.warn(
          `phase47 analytics ingest skipped for ${txn.externalTransactionId}: ${(err as Error).message}`,
        );
      }
    }

    const market = await this.marketResolver.resolveMarketForVendor(
      connection.vendorId,
      data.providerLocationId,
    );

    if (!market) {
      this.logger.debug(
        `Sales ingest wrote ledger=${written} analytics=${analyticsWritten} phase47=${analyticsTxnWritten} vendor=${connection.vendorId} (no approved market)`,
      );
      return { written, analyticsWritten, analyticsTxnWritten, rollups: [] };
    }

    const rollups = buildSnapshotRollupJobs({
      vendorId: connection.vendorId,
      marketId: market.marketId,
      tenantId: connection.tenantId,
      posConnectionId: connection.id,
      transactions: data.transactions,
    });

    this.logger.debug(
      `Sales ingest vendor=${connection.vendorId} market=${market.marketId} ledger=${written} analytics=${analyticsWritten} phase47=${analyticsTxnWritten} rollups=${rollups.length}`,
    );

    return { written, analyticsWritten, analyticsTxnWritten, rollups };
  }
}
