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
  ITEMS: WholesaleOrderDraftItemRow[];
  CREATED_AT: string;
};

/** Wire payload for POST /api/vendors/orders/fulfillment (snake_case). */
export type WholesaleOrderFulfillmentPayload = {
  order_id: string;
  carrier_name: string;
  tracking_number: string;
  estimated_delivery_at: string;
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
