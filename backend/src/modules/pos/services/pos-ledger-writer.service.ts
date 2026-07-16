/**
 * Supabase service-role REST client for POS ledger writes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PosTransactionInsert } from '../types/ledger-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

@Injectable()
export class PosLedgerWriterService {
  private readonly logger = new Logger(PosLedgerWriterService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig | null {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  /**
   * Idempotent upsert on (provider, external_transaction_id).
   * Uses Supabase PostgREST with service-role credentials.
   */
  async upsertTransaction(row: PosTransactionInsert): Promise<{ id: string } | null> {
    const admin = this.adminConfig();
    if (!admin) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for pos_transactions writes',
      );
    }

    if (!row.vendorId || !row.externalTransactionId || !row.provider) {
      throw new Error('vendorId, provider, and externalTransactionId are required');
    }

    const grossAmount = Math.max(0, Math.trunc(row.grossAmount));
    const platformFee = Math.max(0, Math.trunc(row.platformFee));
    if (platformFee > grossAmount) {
      throw new Error('platform_fee cannot exceed gross_amount');
    }

    const body = {
      vendor_id: row.vendorId,
      connection_id: row.connectionId ?? null,
      provider: row.provider,
      external_transaction_id: row.externalTransactionId,
      gross_amount: grossAmount,
      platform_fee: platformFee,
      tax_amount: Math.max(0, Math.trunc(row.taxAmount ?? 0)),
      tip_amount: Math.max(0, Math.trunc(row.tipAmount ?? 0)),
      payment_status: row.paymentStatus ?? 'completed',
      currency: row.currency || 'USD',
      sold_at: row.soldAt,
      raw_payload: row.rawPayload ?? {},
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(
      `${admin.url}/rest/v1/pos_transactions?on_conflict=provider,external_transaction_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: admin.serviceKey,
          Authorization: `Bearer ${admin.serviceKey}`,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(
        `pos_transactions upsert failed (${row.provider}:${row.externalTransactionId}): ${detail.slice(0, 400)}`,
      );
      throw new Error(`pos_transactions upsert failed: ${detail.slice(0, 300)}`);
    }

    const rows = (await res.json()) as Array<{ id: string }>;
    const id = rows[0]?.id;
    if (!id) {
      this.logger.warn(
        `pos_transactions upsert returned no row for ${row.provider}:${row.externalTransactionId}`,
      );
      return null;
    }

    this.logger.log(
      `pos_transactions upserted ${row.provider}:${row.externalTransactionId} → ${id}`,
    );
    return { id };
  }
}
