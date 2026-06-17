/** Decrypted credentials handed to an adapter for a single call. */
export interface ProviderCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  /** ISO timestamp when the access token expires (OAuth). */
  expiresAt?: string | null;
}

export interface OAuthAuthorizeRequest {
  /** CSRF/correlation token; persisted on the connection and echoed back. */
  state: string;
  redirectUri: string;
  scopes?: string[];
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
  merchantId?: string;
  scopes?: string[];
}

export interface ApiKeyValidationResult {
  merchantId?: string;
  locationId?: string;
}

export interface FetchTransactionsParams {
  credentials: ProviderCredentials;
  /** Provider location to scope the query to, when applicable. */
  locationId?: string;
  /** ISO 8601 lower bound (inclusive). */
  since: string;
  /** ISO 8601 upper bound (exclusive). Defaults to now. */
  until?: string;
  cursor?: string | null;
  pageSize?: number;
}

export interface ProviderLocation {
  id: string;
  name: string;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  sku?: string;
}

export interface WebhookVerificationInput {
  rawBody: Buffer | string;
  headers: Record<string, string | undefined>;
  /** Connection-specific signing secret, when known. */
  secret?: string;
}

export interface ParsedWebhook {
  providerEventId: string;
  eventType: string;
  signatureValid: boolean;
  /** Provider merchant/location identifiers, to resolve the connection. */
  providerMerchantId?: string;
  providerLocationId?: string;
  /** Transaction ids the webhook references, when discernible. */
  affectedTransactionIds?: string[];
}

export interface RegisterWebhookResult {
  id: string;
  secret?: string;
}
