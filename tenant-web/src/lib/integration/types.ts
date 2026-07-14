/** POS integration provider slug (matches public.pos_integration_provider enum). */
export type PosIntegrationProvider = 'square' | 'toast' | 'clover';

/** Signed OAuth state payload embedded in the redirect handshake. */
export interface PosOAuthStatePayload {
  vendorId: string;
  userId: string;
  provider: PosIntegrationProvider;
  nonce: string;
  exp: number;
}

/** Normalized token exchange result from provider OAuth endpoints. */
export interface PosOAuthTokenResult {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  merchantId?: string | null;
  locationId?: string | null;
}

/** Row shape for vendor_pos_connections upsert (service-role only). */
export interface VendorPosConnectionRow {
  vendor_id: string;
  user_id: string;
  provider: PosIntegrationProvider;
  /** Prefer null — tokens belong in encrypted_credentials. */
  access_token: string | null;
  /** Prefer null — tokens belong in encrypted_credentials. */
  refresh_token: string | null;
  token_expires_at: string | null;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
  merchant_display_name?: string | null;
  oauth_state: string | null;
  status: 'pending' | 'active' | 'error' | 'expired' | 'disconnected';
  metadata?: Record<string, unknown>;
  updated_at: string;
}

/** Row shape for encrypted_credentials vault upsert (service-role only). */
export interface EncryptedCredentialRow {
  vendor_id: string;
  connection_id: string | null;
  provider: PosIntegrationProvider;
  square_merchant_id: string | null;
  provider_location_id: string | null;
  token_expires_at: string | null;
  merchant_display_name: string | null;
  secret_cipher: string;
  cipher_iv: string;
  cipher_auth_tag: string;
  key_version: number;
  updated_at: string;
}

/** Incoming POS webhook / sync transaction payload (cents). */
export interface PosTransactionPayload {
  vendorId: string;
  connectionId?: string | null;
  provider: PosIntegrationProvider;
  externalTransactionId: string;
  grossAmount: number;
  platformFee?: number;
  currency?: string;
  soldAt: string;
  rawPayload?: Record<string, unknown>;
}

/** Geographic market record for national_farmers_markets ingestion. */
export interface NationalFarmersMarketRecord {
  marketName: string;
  streetAddress?: string | null;
  city: string;
  state: string;
  zipCode?: string | null;
  operatingSchedules?: NationalMarketScheduleEntry[];
  longitude: number;
  latitude: number;
  source?: string | null;
  externalId?: string | null;
}

export interface NationalMarketScheduleEntry {
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  notes?: string | null;
}

export function isPosIntegrationProvider(value: string): value is PosIntegrationProvider {
  return value === 'square' || value === 'toast' || value === 'clover';
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
