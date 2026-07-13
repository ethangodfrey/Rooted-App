/**
 * Ledger transaction types — backend worker mirror of tenant-web sales/types.ts.
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §5
 */

export type LedgerProvider = 'square' | 'toast' | 'clover';

export type LedgerTenderType = 'card' | 'cash' | 'gift_card' | 'digital_wallet' | 'other';

export type LedgerTransactionState = 'completed' | 'refunded' | 'partially_refunded' | 'voided';

/** Maps to public.pos_transactions insert/upsert row. */
export interface PosTransactionInsert {
  vendorId: string;
  connectionId?: string | null;
  provider: LedgerProvider;
  externalTransactionId: string;
  grossAmount: number;
  platformFee: number;
  currency: string;
  soldAt: string;
  rawPayload: Record<string, unknown>;
}

export interface PosSalesIngestJobData {
  provider: LedgerProvider;
  providerEventId: string;
  eventType: string;
  providerMerchantId?: string;
  providerLocationId?: string;
  transactions: Array<{
    externalTransactionId: string;
    providerOrderId?: string | null;
    providerLocationId?: string | null;
    state: LedgerTransactionState;
    soldAt: string;
    currency: string;
    grossAmountCents: number;
    platformFeeCents: number;
    tenderType?: LedgerTenderType;
    cardBrand?: string | null;
    rawPayload: Record<string, unknown>;
  }>;
  observedAt: string;
  rawPayload: Record<string, unknown>;
}

/** Absolute tender counts keyed by LedgerTenderType slug. */
export type TenderBreakdown = Partial<Record<LedgerTenderType, number>> & Record<string, number>;

/** Fractional payment mix keyed by tender slug (sums to ~1.0). */
export type PaymentMethodDistribution = TenderBreakdown;

export interface PosSnapshotRollupJobData {
  vendorId: string;
  marketId: string;
  tenantId?: string | null;
  posConnectionId?: string | null;
  snapshotDate: string;
  tenderBreakdown?: TenderBreakdown;
}

/** Input batch for buildSnapshotRollupJobs — one webhook ingest payload slice. */
export interface SnapshotRollupBatchInput {
  vendorId: string;
  marketId: string;
  tenantId?: string | null;
  posConnectionId?: string | null;
  transactions: Array<{
    state: LedgerTransactionState;
    soldAt: string;
    tenderType?: LedgerTenderType;
  }>;
}

/** pos_transactions row shape used for tender aggregation reads. */
export interface PosTransactionTenderRow {
  id?: string;
  raw_payload: Record<string, unknown>;
}

export interface ResolvedPosConnection {
  id: string;
  vendorId: string;
  userId: string;
  tenantId?: string | null;
  provider: LedgerProvider;
  providerMerchantId?: string | null;
  providerLocationId?: string | null;
  status: string;
}

export interface ResolvedMarketContext {
  marketId: string;
  vendorId: string;
  tenantId?: string | null;
}
