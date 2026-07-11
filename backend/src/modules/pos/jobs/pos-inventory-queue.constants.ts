export const POS_INVENTORY_INGEST_QUEUE = 'pos-inventory-ingest';
export const POS_INVENTORY_FLUSH_QUEUE = 'pos-inventory-flush';

export const POS_INVENTORY_JOBS = {
  /** Raw webhook envelope from the Next.js ingest layer. */
  INGEST_WEBHOOK: 'ingest-webhook',
  /** Debounced flush after coalescing rapid deltas for one product/event pair. */
  FLUSH_COALESCED: 'flush-coalesced',
  /** Online storefront purchase — deduct dual-channel stock + audit row. */
  ONLINE_SALE_DEDUCT: 'online-sale-deduct',
} as const;

/** Milliseconds to buffer rapid duplicate product updates before writing once. */
export const POS_INVENTORY_COALESCE_MS = 3_000;

export type PosInventoryProvider = 'SQUARE' | 'TOAST';

export interface PosInventoryWebhookJobData {
  provider: PosInventoryProvider;
  providerEventId: string;
  eventType: string;
  providerMerchantId?: string;
  providerLocationId?: string;
  providerCatalogObjectId: string;
  /** Relative stock change when the webhook reports a delta. */
  quantityDelta?: number;
  /** Absolute on-hand count when the webhook reports inventory level. */
  quantityAbsolute?: number;
  observedAt: string;
  rawPayload: Record<string, unknown>;
}

export interface PosInventoryFlushJobData {
  productId: string;
  eventId: string;
  vendorId: string;
  coalesceKey: string;
}

/** Payload enqueued after a successful in-app storefront checkout. */
export interface PosInventoryOnlineSaleJobData {
  orderId: string;
  vendorId: string;
  eventId: string;
  productId: string;
  quantity: number;
  provider?: PosInventoryProvider | null;
  providerCatalogObjectId?: string | null;
}
