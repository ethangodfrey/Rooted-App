/**
 * Core sales webhook ingest — shared by BullMQ processor and inline fallback.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PosLedgerWriterService } from './pos-ledger-writer.service';
import { PosMarketResolverService } from './pos-market-resolver.service';
import type { PosSalesIngestJobData } from '../types/ledger-transaction';

@Injectable()
export class PosSalesIngestService {
  private readonly logger = new Logger(PosSalesIngestService.name);

  constructor(
    private readonly ledger: PosLedgerWriterService,
    private readonly marketResolver: PosMarketResolverService,
  ) {}

  async ingest(data: PosSalesIngestJobData): Promise<number> {
    const connection = await this.marketResolver.resolveConnection(
      data.provider,
      data.providerMerchantId,
      data.providerLocationId,
    );

    if (!connection) {
      this.logger.warn(
        `No active vendor_pos_connections for ${data.provider} event ${data.providerEventId}`,
      );
      return 0;
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
    if (market) {
      this.logger.debug(
        `Sales ingest linked vendor=${connection.vendorId} market=${market.marketId} (${written} txns)`,
      );
    }

    return written;
  }
}
