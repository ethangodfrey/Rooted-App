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
  STATUS: string;
};

export type WholesaleCatalogResponse = {
  STATUS: string;
  VIEW?: string;
  VENDOR_ID?: string;
  VENDOR_NAME?: string | null;
  COUNT: number;
  PRODUCTS: WholesaleProductRow[];
  error?: string;
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
