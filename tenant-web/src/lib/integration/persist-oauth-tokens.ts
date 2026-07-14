import { encryptCredentials } from '@/lib/crypto/credential-cipher';
import { upsertEncryptedCredentials } from '@/lib/integration/encrypted-credentials-db';
import { upsertVendorPosConnection } from '@/lib/integration/pos-connections-db';
import { fetchSquareMerchantDisplayName } from '@/lib/integration/square-merchant';
import type {
  PosIntegrationProvider,
  PosOAuthTokenResult,
} from '@/lib/integration/types';

export interface PersistOAuthTokensInput {
  vendorId: string;
  userId: string;
  provider: PosIntegrationProvider;
  tokens: PosOAuthTokenResult;
  oauthState: string;
  connectedVia: string;
}

/**
 * Encrypts tokens into encrypted_credentials and updates vendor_pos_connections
 * metadata **without** persisting plaintext access/refresh tokens.
 */
export async function persistOAuthTokens(input: PersistOAuthTokensInput): Promise<void> {
  const { vendorId, userId, provider, tokens, oauthState, connectedVia } = input;

  let merchantDisplayName: string | null = null;
  if (provider === 'square') {
    merchantDisplayName = await fetchSquareMerchantDisplayName(
      tokens.accessToken,
      tokens.merchantId,
    );
  }

  const connection = await upsertVendorPosConnection({
    vendor_id: vendorId,
    user_id: userId,
    provider,
    access_token: null,
    refresh_token: null,
    token_expires_at: tokens.expiresAt ?? null,
    provider_merchant_id: tokens.merchantId ?? null,
    provider_location_id: tokens.locationId ?? null,
    merchant_display_name: merchantDisplayName,
    oauth_state: null,
    status: 'active',
    metadata: {
      connectedVia,
      lastOAuthStatePrefix: oauthState.slice(0, 16),
      merchantDisplayName,
    },
    updated_at: new Date().toISOString(),
  });

  const sealed = encryptCredentials({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? null,
    merchantId: tokens.merchantId ?? null,
    locationId: tokens.locationId ?? null,
    expiresAt: tokens.expiresAt ?? null,
  });

  await upsertEncryptedCredentials({
    vendor_id: vendorId,
    connection_id: connection?.id ?? null,
    provider,
    square_merchant_id: provider === 'square' ? (tokens.merchantId ?? null) : null,
    provider_location_id: tokens.locationId ?? null,
    token_expires_at: tokens.expiresAt ?? null,
    merchant_display_name: merchantDisplayName,
    secret_cipher: sealed.secretCipher,
    cipher_iv: sealed.cipherIv,
    cipher_auth_tag: sealed.cipherAuthTag,
    key_version: sealed.keyVersion,
    updated_at: new Date().toISOString(),
  });
}
