/**
 * Consumes pos-sales-ingest queue → pos_transactions + debounced rollup enqueue.
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §4
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { POS_SALES_INGEST_JOB, POS_SALES_INGEST_QUEUE } from './pos-sales-queue.constants';
import { PosLedgerWriterService } from '../services/pos-ledger-writer.service';
import { PosMarketResolverService } from '../services/pos-market-resolver.service';
import type { PosSalesIngestJobData } from '../types/ledger-transaction';

@Processor(POS_SALES_INGEST_QUEUE)
export class PosSalesIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(PosSalesIngestProcessor.name);

  constructor(
    private readonly ledger: PosLedgerWriterService,
    private readonly marketResolver: PosMarketResolverService,
  ) {
    super();
  }

  async process(job: Job<PosSalesIngestJobData>): Promise<void> {
    if (job.name !== POS_SALES_INGEST_JOB) return;

    const data = job.data;
    this.logger.log(
      `pos-sales-ingest scaffold: ${data.provider} event=${data.providerEventId}`,
    );

    const connection = await this.marketResolver.resolveConnection(
      data.provider,
      data.providerMerchantId,
      data.providerLocationId,
    );
    if (!connection) {
      this.logger.warn(`No active connection for ${data.provider} event ${data.providerEventId}`);
      return;
    }

    for (const txn of data.transactions) {
      await this.ledger.upsertTransaction({
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
    }

    // TODO: enqueue PosSnapshotRollupProcessor with debounce
  }
}
