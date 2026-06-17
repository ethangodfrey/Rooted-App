import type { PosAuthType, PosProvider } from '@prisma/client';

import type { TransactionPage } from '../types/normalized-transaction';
import type {
  ApiKeyValidationResult,
  FetchTransactionsParams,
  OAuthAuthorizeRequest,
  OAuthTokenResult,
  ParsedWebhook,
  ProviderCatalogItem,
  ProviderCredentials,
  ProviderLocation,
  RegisterWebhookResult,
  WebhookVerificationInput,
} from '../types/provider.types';

/**
 * Contract every POS provider integration implements. Connection/sync/import
 * services depend only on this interface, never on a concrete provider.
 *
 * Auth-type-specific methods:
 *  - OAuth providers implement getAuthorizeUrl / exchangeOAuthCode / refreshAccessToken.
 *  - API-key providers implement validateApiKey.
 * Methods that do not apply to a provider should throw NotImplementedException.
 */
export interface PosProviderAdapter {
  readonly provider: PosProvider;
  readonly authType: PosAuthType;

  // --- OAuth connection lifecycle ---
  getAuthorizeUrl(request: OAuthAuthorizeRequest): string;
  exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokenResult>;
  refreshAccessToken(credentials: ProviderCredentials): Promise<OAuthTokenResult>;

  // --- API-key connection lifecycle ---
  validateApiKey(credentials: ProviderCredentials): Promise<ApiKeyValidationResult>;

  // --- Provider metadata ---
  listLocations(credentials: ProviderCredentials): Promise<ProviderLocation[]>;
  listCatalogItems(
    credentials: ProviderCredentials,
    locationId?: string,
  ): Promise<ProviderCatalogItem[]>;

  // --- Data ingestion ---
  fetchTransactions(params: FetchTransactionsParams): Promise<TransactionPage>;

  // --- Webhooks ---
  verifyWebhook(input: WebhookVerificationInput): ParsedWebhook;
  registerWebhook?(
    credentials: ProviderCredentials,
    callbackUrl: string,
  ): Promise<RegisterWebhookResult>;
  deleteWebhook?(credentials: ProviderCredentials, subscriptionId: string): Promise<void>;
}

/** DI token collection for provider adapters. */
export const POS_ADAPTERS = Symbol('POS_ADAPTERS');
