/**
 * Writes normalized sales events to public.pos_transactions (service-role).
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §5
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PosTransactionInsert } from '../types/ledger-transaction';

@Injectable()
export class PosLedgerWriterService {
  private readonly logger = new Logger(PosLedgerWriterService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Idempotent upsert on (provider, external_transaction_id).
   * Uses Supabase REST with service-role key.
   */
  async upsertTransaction(row: PosTransactionInsert): Promise<{ id: string } | null> {
    // TODO: POST /rest/v1/pos_transactions?on_conflict=provider,external_transaction_id
    this.logger.debug(
      `upsertTransaction scaffold: ${row.provider}:${row.externalTransactionId}`,
    );
    void this.config;
    return null;
  }
}
