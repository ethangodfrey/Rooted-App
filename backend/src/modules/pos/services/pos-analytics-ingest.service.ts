/**
 * Phase 47 — upsert unified analytics transactions + line items into Supabase.
 *
 * Tables:
 *   - pos_analytics_transactions  (conflict: provider, external_transaction_id)
 *   - pos_analytics_transaction_items
 *
 * Uses PostgREST with the service role (same pattern as PosLedgerWriterService).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  mapSquareOrderToTransaction,
  mapSquarePayloadToTransaction,
  mapSquarePaymentToTransaction,
} from '../mappers/square-analytics.mapper';
import type {
  AnalyticsIngestContext,
  Transaction,
  TransactionItem,
} from '../types/analytics-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

export interface AnalyticsIngestResult {
  transactionId: string;
  externalTransactionId: string;
  itemCount: number;
}

@Injectable()
export class PosAnalyticsIngestService {
  private readonly logger = new Logger(PosAnalyticsIngestService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig | null {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  private requireAdmin(): SupabaseAdminConfig {
    const admin = this.adminConfig();
    if (!admin) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for POS analytics ingest',
      );
    }
    return admin;
  }

  /** Map a raw Square order/payment payload then upsert. */
  async ingestSquarePayload(
    payload: unknown,
    context: AnalyticsIngestContext,
  ): Promise<AnalyticsIngestResult | null> {
    const txn = mapSquarePayloadToTransaction(payload, {
      ...context,
      provider: 'square',
    });
    if (!txn) {
      this.logger.warn('Square payload produced no analytics transaction');
      return null;
    }
    return this.upsertTransaction(txn);
  }

  async ingestSquareOrder(
    order: unknown,
    context: AnalyticsIngestContext,
  ): Promise<AnalyticsIngestResult | null> {
    const txn = mapSquareOrderToTransaction(order, {
      ...context,
      provider: 'square',
    });
    if (!txn) return null;
    return this.upsertTransaction(txn);
  }

  async ingestSquarePayment(
    payment: unknown,
    context: AnalyticsIngestContext,
    order?: unknown,
  ): Promise<AnalyticsIngestResult | null> {
    const txn = mapSquarePaymentToTransaction(
      payment,
      { ...context, provider: 'square' },
      order,
    );
    if (!txn) return null;
    return this.upsertTransaction(txn);
  }

  /**
   * Idempotent upsert of a unified Transaction (+ replace line items).
   * Conflict target: (provider, external_transaction_id).
   */
  async upsertTransaction(txn: Transaction): Promise<AnalyticsIngestResult> {
    const admin = this.requireAdmin();

    if (!txn.vendorId || !txn.externalTransactionId || !txn.provider) {
      throw new Error('vendorId, provider, and externalTransactionId are required');
    }

    const body = {
      external_transaction_id: txn.externalTransactionId,
      vendor_id: txn.vendorId,
      pos_connection_id: txn.posConnectionId ?? null,
      provider: txn.provider,
      total_amount_cents: Math.max(0, Math.trunc(txn.totalAmountCents)),
      tax_amount_cents: Math.max(0, Math.trunc(txn.taxAmountCents)),
      tip_amount_cents: Math.max(0, Math.trunc(txn.tipAmountCents)),
      currency: txn.currency || 'USD',
      payment_status: txn.paymentStatus,
      transaction_created_at: txn.transactionCreatedAt,
      provider_location_id: txn.providerLocationId ?? null,
      raw_payload: txn.rawPayload ?? {},
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(
      `${admin.url}/rest/v1/pos_analytics_transactions?on_conflict=provider,external_transaction_id`,
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
        `pos_analytics_transactions upsert failed (${txn.provider}:${txn.externalTransactionId}): ${detail.slice(0, 400)}`,
      );
      throw new Error(`pos_analytics_transactions upsert failed: ${detail.slice(0, 300)}`);
    }

    const rows = (await res.json()) as Array<{ id: string }>;
    const transactionId = rows[0]?.id;
    if (!transactionId) {
      throw new Error(
        `pos_analytics_transactions upsert returned no row for ${txn.provider}:${txn.externalTransactionId}`,
      );
    }

    const itemCount = await this.replaceLineItems(admin, transactionId, txn.items ?? []);

    this.logger.log(
      `pos_analytics_transactions upserted ${txn.provider}:${txn.externalTransactionId} → ${transactionId} (${itemCount} items)`,
    );

    return {
      transactionId,
      externalTransactionId: txn.externalTransactionId,
      itemCount,
    };
  }

  async upsertMany(transactions: Transaction[]): Promise<AnalyticsIngestResult[]> {
    const results: AnalyticsIngestResult[] = [];
    for (const txn of transactions) {
      results.push(await this.upsertTransaction(txn));
    }
    return results;
  }

  /**
   * Replace line items for a transaction (delete + insert) so re-sync is idempotent.
   */
  private async replaceLineItems(
    admin: SupabaseAdminConfig,
    transactionId: string,
    items: TransactionItem[],
  ): Promise<number> {
    const del = await fetch(
      `${admin.url}/rest/v1/pos_analytics_transaction_items?transaction_id=eq.${encodeURIComponent(transactionId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: admin.serviceKey,
          Authorization: `Bearer ${admin.serviceKey}`,
          Prefer: 'return=minimal',
        },
      },
    );
    if (!del.ok) {
      const detail = await del.text();
      throw new Error(`Failed to clear analytics line items: ${detail.slice(0, 300)}`);
    }

    if (items.length === 0) return 0;

    const rows = items.map((item) => ({
      transaction_id: transactionId,
      external_item_id: item.externalItemId ?? null,
      name: item.name || 'Register item',
      quantity: item.quantity > 0 ? item.quantity : 1,
      unit_price_cents: Math.trunc(item.unitPriceCents),
      total_price_cents: Math.trunc(item.totalPriceCents),
      provider_catalog_id: item.providerCatalogId ?? null,
      raw_payload: item.rawPayload ?? {},
      updated_at: new Date().toISOString(),
    }));

    const ins = await fetch(`${admin.url}/rest/v1/pos_analytics_transaction_items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: admin.serviceKey,
        Authorization: `Bearer ${admin.serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!ins.ok) {
      const detail = await ins.text();
      throw new Error(`Failed to insert analytics line items: ${detail.slice(0, 300)}`);
    }

    return rows.length;
  }
}
