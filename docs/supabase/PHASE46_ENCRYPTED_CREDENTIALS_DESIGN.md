# Phase 46 — Square OAuth token encryption design

## Problem

`vendor_pos_connections` currently stores `access_token` / `refresh_token` as plaintext. Authenticated vendors can `SELECT` their own rows (phase43c RLS), which risks token exfiltration via the browser Supabase client. Nest already encrypts credentials in `pos_credentials` (AES-256-GCM + `POS_CREDENTIAL_KEY`); tenant-web OAuth did not.

## Design

### Vault table: `encrypted_credentials`

Separate secret vault (not columns on `vendors` / profiles):

| Column | Purpose |
|--------|---------|
| `vendor_id`, `provider` | Ownership + uniqueness |
| `connection_id` | FK → `vendor_pos_connections` |
| `square_merchant_id` | Non-secret index for webhook routing |
| `token_expires_at` | Refresh scheduling without decrypt |
| `merchant_display_name` | Safe UI label |
| `secret_cipher`, `cipher_iv`, `cipher_auth_tag`, `key_version` | AES-256-GCM sealed JSON payload |

**Sealed payload JSON** (same shape as Nest `ProviderCredentials` intent):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "merchantId": "...",
  "locationId": null,
  "expiresAt": "..."
}
```

Encryption key: `POS_CREDENTIAL_KEY` (32-byte base64), shared with Nest so either stack can decrypt. Never store the key in the database. Never rotate without a re-encrypt migration.

### Connection metadata table (non-secret)

`vendor_pos_connections` remains the status/ledger FK surface:

- Keep `provider_merchant_id`, `provider_location_id`, `status`, `token_expires_at`, `merchant_display_name`
- **Stop writing plaintext tokens** from the new Square OAuth callback (set token columns `NULL`)
- Column grants revoke `access_token` / `refresh_token` / `oauth_state` from `authenticated`

### RLS / access

| Principal | `encrypted_credentials` | Public status view |
|-----------|-------------------------|--------------------|
| `anon` | no access | no |
| `authenticated` vendor | **no** table access (ciphertext never granted) | `encrypted_credentials_public` / `vendor_pos_connections_public` — status + merchant name only |
| `service_role` | full read/write (OAuth callback, refresh workers) | n/a |

### OAuth routes (tenant-web)

| Route | Role |
|-------|------|
| `GET /api/auth/square` | Signed CSRF `state`, redirect (or JSON) to Square authorize URL |
| `GET /api/auth/callback/square` | Validate `state`, exchange `code`, encrypt + vault write, update connection row |

Existing `/api/integration/*` routes remain for multi-provider connect; Square production onboarding prefers `/api/auth/square*`.

### Env

- `POS_CREDENTIAL_KEY` — required for encrypt-on-write
- `SQUARE_APPLICATION_ID` / `SQUARE_APPLICATION_SECRET` / `SQUARE_ENVIRONMENT=production`
- `INTEGRATION_OAUTH_BASE_URL` — public tenant-web origin (callback registration)
- `POS_OAUTH_STATE_SECRET` — HMAC for CSRF state
- `INTEGRATION_CORS_ORIGINS` — SPA origins allowed to call connect with Bearer

## Apply

Run `docs/supabase/phase46_encrypted_credentials.sql` in the Supabase SQL Editor after phase45.
