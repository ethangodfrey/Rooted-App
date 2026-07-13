/**
 * Sales webhook contracts — tenant-web edge ingest.
 * Mirror in backend/src/modules/pos/types/ledger-transaction.ts for workers.
 */

import type { PosIntegrationProvider } from '@/lib/integration/types';

/** Provider-agnostic tender classification for rollup distribution. */
export type SalesTenderType = 'card' | 'cash' | 'gift_card' | 'digital_wallet' | 'other';

export type SalesTransactionState = 'completed' | 'refunded' | 'partially_refunded' | 'voided';

/**
 * Normalized sales event extracted at the edge (or enriched by worker).
 * Maps 1:1 to public.pos_transactions insert rows.
 */
export interface NormalizedLedgerTransaction {
  externalTransactionId: string;
  providerOrderId?: string | null;
  providerLocationId?: string | null;
  state: SalesTransactionState;
  soldAt: string;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  tenderType?: SalesTenderType;
  cardBrand?: string | null;
  rawPayload: Record<string, unknown>;
}

/** Parsed result from a single provider webhook POST. */
export interface ParsedSalesWebhook {
  provider: PosIntegrationProvider;
  providerEventId: string;
  eventType: string;
  signatureValid: boolean;
  providerMerchantId?: string;
  providerLocationId?: string;
  transactions: NormalizedLedgerTransaction[];
  rawPayload: Record<string, unknown>;
}

/** BullMQ job payload — tenant-web producer → backend consumer. */
export interface PosSalesIngestJobData {
  provider: PosIntegrationProvider;
  providerEventId: string;
  eventType: string;
  providerMerchantId?: string;
  providerLocationId?: string;
  transactions: NormalizedLedgerTransaction[];
  observedAt: string;
  rawPayload: Record<string, unknown>;
}

/** Debounced rollup job — one per vendor + market + UTC day. */
export interface PosSnapshotRollupJobData {
  vendorId: string;
  marketId: string;
  tenantId?: string | null;
  posConnectionId?: string | null;
  snapshotDate: string;
  tenderBreakdown?: Record<string, number>;
}

const SALES_EVENT_PREFIXES = ['payment.', 'refund.', 'order.'] as const;

export function isSalesWebhookEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return SALES_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function toSnapshotDateUtc(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export function computeTenderDistribution(
  breakdown: Record<string, number>,
): Record<string, number> {
  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(breakdown)) {
    out[key] = Math.round((count / total) * 10_000) / 10_000;
  }
  return out;
}
