# POS integrations

## Providers

Adapters in `backend/src/modules/pos/adapters/` (Square, Toast, Clover). Provider registry selects by connection type.

## OAuth and webhooks

- OAuth callback: `{PUBLIC_BASE_URL}/pos/oauth/{provider}/callback`
- Webhooks: `{PUBLIC_BASE_URL}/pos/webhooks/{provider}`
- `APP_DEEP_LINK=vendorly://pos/connected` — mobile return after connect

## Credential storage

POS tokens encrypted with `POS_CREDENTIAL_KEY` (AES-256-GCM). **Never change this key** after vendors connect — they must reconnect.

- Nest: `pos_credentials` (phase12)
- tenant-web OAuth: `encrypted_credentials` (phase46) — plaintext token columns on `vendor_pos_connections` are no longer written
- Square production onboarding: `{TENANT_WEB}/api/auth/square` → `{TENANT_WEB}/api/auth/callback/square`

## Square setup

See `docs/SQUARE_SETUP.md`. Register HTTPS redirect and webhook URLs against deployed `PUBLIC_BASE_URL`.

## Web usage

Vendor POS pages call backend via web `api.ts` — requires `VITE_API_URL` pointing at deployed API.
