/**
 * Provider-agnostic normalized transaction model. Every adapter converts its
 * provider's payment/order payloads into these shapes so the import + analytics
 * pipeline never sees provider-specific data. All monetary values are integer
 * cents in the transaction `currency`.
 */

export type NormalizedTenderType = 'CARD' | 'CASH' | 'GIFT_CARD' | 'OTHER';

export type NormalizedTransactionState =
  | 'COMPLETED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'VOIDED';

export interface NormalizedLineItem {
  providerLineItemId?: string;
  providerCatalogObjectId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  raw?: unknown;
}

export interface NormalizedTransaction {
  providerTransactionId: string;
  providerOrderId?: string;
  providerLocationId?: string;
  state: NormalizedTransactionState;
  /** ISO 8601 timestamp of the sale. */
  soldAt: string;
  currency: string;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  netAmount: number;
  tenderType?: NormalizedTenderType;
  cardBrand?: string;
  lineItems: NormalizedLineItem[];
  /** Original provider payload, persisted for audit/debugging. */
  raw: unknown;
}

export interface TransactionPage {
  transactions: NormalizedTransaction[];
  /** Opaque provider cursor for the next page, or null when exhausted. */
  nextCursor?: string | null;
}
