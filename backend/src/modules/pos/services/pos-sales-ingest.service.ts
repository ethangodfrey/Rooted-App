/**
 * Core sales webhook ingest — shared by BullMQ processor and inline fallback.
 */

import { Injectable, Logger } from '@nestjs/common';

import { buildSnapshotRollupJobs } from '../utils/tender-aggregation';
import { PosLedgerWriterService } from './pos-ledger-writer.service';
import { PosMarketResolverService } from './pos-market-resolver.service';
import type { PosSalesIngestJobData, PosSnapshotRollupJobData } from '../types/ledger-transaction';

export interface PosSalesIngestResult {
  written: number;
  rollups: PosSnapshotRollupJobData[];
}

@Injectable()
export class PosSalesIngestService {
  private readonly logger = new Logger(PosSalesIngestService.name);

  constructor(
    private readonly ledger: PosLedgerWriterService,
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
      return { written: 0, rollups: [] };
    }

    let written = 0;
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
    }

    const market = await this.marketResolver.resolveMarketForVendor(
      connection.vendorId,
      data.providerLocationId,
    );

    if (!market) {
      this.logger.debug(
        `Sales ingest wrote ${written} txns for vendor=${connection.vendorId} (no approved market registration)`,
      );
      return { written, rollups: [] };
    }

    const rollups = buildSnapshotRollupJobs({
      vendorId: connection.vendorId,
      marketId: market.marketId,
      tenantId: connection.tenantId,
      posConnectionId: connection.id,
      transactions: data.transactions,
    });

    this.logger.debug(
      `Sales ingest vendor=${connection.vendorId} market=${market.marketId} wrote=${written} rollups=${rollups.length}`,
    );

    return { written, rollups };
  }
}
