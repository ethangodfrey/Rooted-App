export type WholesalePricingTier = Array<{
  minQty: number;
  unitPriceCents: number;
}>;

export type WholesaleProductRow = {
  ID: string;
  VENDOR_ID?: string;
  NAME: string;
  PACKAGING_UNIT: string;
  WEIGHT_LBS: number;
  MOQ: number;
  UNIT_PRICE_CENTS: number;
  PRICING_TIERS: WholesalePricingTier | unknown;
  FREIGHT_NOTES: string | null;
  PICKUP_NOTES: string | null;
  AVAILABLE_QUANTITY?: number;
  STATUS: string;
};

export type WholesaleOrderStatusCode =
  | 'ORDER_DRAFT_INITIALIZED'
  | 'ORDER_ACCEPTED_BY_SELLER'
  | 'ORDER_REJECTED_BY_SELLER'
  | 'ORDER_SHIPPED_IN_TRANSIT'
  | 'ORDER_DELIVERY_CONFIRMED'
  | string;

export type WholesaleCatalogResponse = {
  STATUS: string;
  VIEW?: string;
  SESSION_VENDOR_ID?: string;
  VENDOR_ID?: string;
  VENDOR_NAME?: string | null;
  COUNT: number;
  PRODUCTS: WholesaleProductRow[];
  error?: string;
};

/** Wire payload for POST /api/vendors/orders/drafts (snake_case). */
export type WholesaleOrderDraftItemPayload = {
  product_sku_id: string;
  quantity: number;
  negotiated_tier_unit_price: number;
};

export type WholesaleOrderDraftPayload = {
  buyer_vendor_id: string;
  seller_vendor_id: string;
  items: WholesaleOrderDraftItemPayload[];
};

export type WholesaleOrderDraftItemRow = {
  ID: string;
  PRODUCT_SKU_ID: string;
  QUANTITY: number;
  NEGOTIATED_TIER_UNIT_PRICE: number;
  LINE_TOTAL_CENTS: number;
};

export type WholesaleOrderDraftRow = {
  ID: string;
  BUYER_VENDOR_ID: string;
  SELLER_VENDOR_ID: string;
  BUYER_VENDOR_NAME?: string | null;
  SELLER_VENDOR_NAME?: string | null;
  STATUS: WholesaleOrderStatusCode;
  CURRENCY: string;
  SUBTOTAL_CENTS: number;
  CARRIER_NAME?: string | null;
  TRACKING_NUMBER?: string | null;
  ESTIMATED_DELIVERY_AT?: string | null;
  SHIPPED_AT?: string | null;
  DELIVERED_AT?: string | null;
  DELIVERY_CONFIRMED_AT?: string | null;
  INVOICE_ID?: string | null;
  INVOICE_NUMBER?: string | null;
  ITEMS: WholesaleOrderDraftItemRow[];
  CREATED_AT: string;
};

export type WholesaleInvoiceLineItem = {
  productSkuId?: string;
  PRODUCT_SKU_ID?: string;
  quantity?: number;
  QUANTITY?: number;
  unitPriceCents?: number;
  UNIT_PRICE_CENTS?: number;
  lineTotalCents?: number;
  LINE_TOTAL_CENTS?: number;
};

export type WholesaleInvoiceDisplayStatus = 'PENDING' | 'PAID' | 'OVERDUE';

export type WholesaleInvoiceRow = {
  ID: string;
  ORDER_ID: string;
  SETTLEMENT_LOG_ID?: string | null;
  INVOICE_NUMBER: string;
  BUYER_VENDOR_ID: string;
  SELLER_VENDOR_ID: string;
  BUYER_BUSINESS_NAME?: string | null;
  SELLER_BUSINESS_NAME?: string | null;
  CURRENCY: string;
  SUBTOTAL_CENTS: number;
  TOTAL_CENTS: number;
  PAYMENT_TERMS: string;
  LINE_ITEMS: WholesaleInvoiceLineItem[];
  STATUS: string;
  DISPLAY_STATUS?: WholesaleInvoiceDisplayStatus | string;
  ISSUED_AT: string;
  DUE_AT: string;
  PAID_AT?: string | null;
};

export type WholesaleInvoiceResponse = {
  STATUS: string;
  SESSION_VENDOR_ID?: string;
  VIEWER_ROLE?: 'SELLER' | 'BUYER' | 'UNKNOWN' | string;
  CAN_RECONCILE?: boolean;
  DISPLAY_STATUS?: WholesaleInvoiceDisplayStatus | string;
  INVOICE?: WholesaleInvoiceRow;
  error?: string;
};

export type WholesaleInvoiceReconcilePayload = {
  invoice_id: string;
  paid_at?: string;
};

export type WholesaleInvoiceReconcileResponse = {
  STATUS: string;
  LEDGER?: string;
  DISPLAY_STATUS?: WholesaleInvoiceDisplayStatus | string;
  INVOICE?: WholesaleInvoiceRow;
  error?: string;
  message?: string;
};

/** Seller A/R command-center metrics from GET /api/vendors/invoices/ar-metrics */
export type SupplierArMetrics = {
  TOTAL_REVENUE_CENTS: number;
  OUTSTANDING_CAPITAL_CENTS: number;
  AT_RISK_CAPITAL_CENTS: number;
};

export type SupplierArMetricsResponse = {
  STATUS: string;
  SESSION_VENDOR_ID?: string;
  CURRENCY?: string;
  TOTAL_REVENUE_CENTS?: number;
  OUTSTANDING_CAPITAL_CENTS?: number;
  AT_RISK_CAPITAL_CENTS?: number;
  COUNTS?: {
    PAID?: number;
    PENDING?: number;
    OVERDUE?: number;
  };
  METRICS?: SupplierArMetrics;
  error?: string;
  message?: string;
};

/** Wire payload for POST /api/vendors/orders/fulfillment (snake_case). */
export type WholesaleOrderFulfillmentPayload = {
  order_id: string;
  carrier_name: string;
  tracking_number: string;
  estimated_delivery_at: string;
};

/** Wire payload for POST /api/vendors/orders/settlement (snake_case). */
export type WholesaleOrderSettlementPayload = {
  order_id: string;
  delivered_at: string;
};

export type WholesaleOrderDraftResponse = {
  STATUS: string;
  ORDER?: WholesaleOrderDraftRow;
  error?: string;
  message?: string;
};

export type WholesaleInboundOrdersResponse = {
  STATUS: string;
  VIEW?: string;
  SESSION_VENDOR_ID?: string;
  COUNT: number;
  ORDERS: WholesaleOrderDraftRow[];
  error?: string;
};

export type WholesaleOutboundOrdersResponse = {
  STATUS: string;
  VIEW?: string;
  SESSION_VENDOR_ID?: string;
  COUNT: number;
  ORDERS: WholesaleOrderDraftRow[];
  error?: string;
};

export type WholesaleOrderSettlementResponse = {
  STATUS: string;
  LEDGER?: string;
  BILLING?: string;
  INVOICE?: WholesaleInvoiceRow;
  ORDER?: WholesaleOrderDraftRow;
  error?: string;
  message?: string;
};

export type WholesaleOrderActionResponse = {
  STATUS: string;
  ORDER?: WholesaleOrderDraftRow;
  error?: string;
  message?: string;
};

export type BusinessConnectionStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type BusinessConnectionRow = {
  ID: string;
  SENDER_VENDOR_ID: string;
  RECEIVER_VENDOR_ID: string;
  STATUS: BusinessConnectionStatus;
  INITIATED_AT: string;
};

export type BusinessConnectionStatusResponse = {
  STATUS: string;
  PEER_VENDOR_ID?: string;
  CONNECTION: BusinessConnectionRow | null;
  error?: string;
};

export type BusinessConnectionRequestResponse = {
  STATUS: string;
  CONNECTION?: BusinessConnectionRow;
  error?: string;
  message?: string;
};
