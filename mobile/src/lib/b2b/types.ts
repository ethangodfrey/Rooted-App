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

export type WholesaleOrderDraftResponse = {
  STATUS: string;
  ORDER?: WholesaleOrderDraftRow;
  error?: string;
  message?: string;
};
