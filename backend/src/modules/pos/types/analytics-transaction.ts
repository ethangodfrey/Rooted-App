/**
 * Platform-agnostic POS analytics transaction models (phase47).
 * All monetary fields are integer cents — never floating-point dollars.
 */

export type AnalyticsPosProvider = 'square' | 'toast' | 'clover';

export type AnalyticsPaymentStatus =
  | 'pending'
  | 'completed'
  | 'refunded'
  | 'partially_refunded'
  | 'voided'
  | 'failed';

/** Unified internal line item for analytics ingestion. */
export interface TransactionItem {
  /** Provider line/order item id when available. */
  externalItemId?: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  providerCatalogId?: string | null;
  rawPayload?: Record<string, unknown>;
}

/** Unified internal sale row for analytics ingestion. */
export interface Transaction {
  externalTransactionId: string;
  vendorId: string;
  posConnectionId?: string | null;
  provider: AnalyticsPosProvider;
  totalAmountCents: number;
  taxAmountCents: number;
  tipAmountCents: number;
  currency: string;
  paymentStatus: AnalyticsPaymentStatus;
  /** Native provider sale timestamp (ISO 8601). */
  transactionCreatedAt: string;
  providerLocationId?: string | null;
  items: TransactionItem[];
  rawPayload?: Record<string, unknown>;
}

/** Context required to bind Square (or other) payloads to a vendor connection. */
export interface AnalyticsIngestContext {
  vendorId: string;
  posConnectionId?: string | null;
  provider: AnalyticsPosProvider;
}
