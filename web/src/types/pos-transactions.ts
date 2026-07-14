/** Row shape from public.pos_transactions (amounts in cents). */
export type PosIntegrationProvider = 'square' | 'toast' | 'clover';

export interface PosTransactionRow {
  id: string;
  vendor_id: string;
  connection_id: string | null;
  provider: PosIntegrationProvider;
  external_transaction_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  currency: string;
  sold_at: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VendorPosConnectionPublic {
  id: string;
  vendor_id: string;
  user_id: string;
  provider: PosIntegrationProvider;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
  merchant_display_name?: string | null;
  status: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PosLedgerSummary {
  grossTotal: number;
  platformFeeTotal: number;
  netTotal: number;
  transactionCount: number;
  byProvider: { provider: PosIntegrationProvider; count: number; netTotal: number }[];
  dailyNet: { date: string; label: string; net: number; gross: number; fees: number }[];
}

export interface NearbyNationalMarket {
  id: string;
  marketName: string;
  streetAddress: string | null;
  city: string;
  state: string;
  zipCode: string | null;
  operatingSchedules: unknown[];
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number;
}

export const POS_PROVIDER_LABELS: Record<PosIntegrationProvider, string> = {
  square: 'Square',
  toast: 'Toast',
  clover: 'Clover',
};
