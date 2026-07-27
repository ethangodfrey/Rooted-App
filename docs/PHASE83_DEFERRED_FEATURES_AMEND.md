# Phase 83 — Deferred feature amend

Conflicted leftover branches could not land cleanly on `main` after the
platform stack merge. Phase 83 amends them into the current tree
**additively** (new pages/libs + SQL renumbered off the old phase50 collision),
plus Nest ORM/services for classifications, V2V connections, and flash promo.

## Source branches (kept for reference until this PR merges)

| Track | Source branch | Phase 83 surface |
|-------|---------------|------------------|
| 83a Home / Private Chef / Micro-Brand | `cursor/home-private-chef-vendor-types-428e` | SQL + Prisma `vendorType` + `HOME`/`PRIVATE_CHEF`/`MICRO_BRAND` helpers |
| 83b V2V connections | `cursor/vendor-to-vendor-connections-428e` | SQL + `V2vConnectionsService` (`/api/v2v/connections`) |
| 83c Mix analytics | `cursor/admin-mix-analytics-428e` | `/admin/mix-analytics` + `/admin/analytics` |
| 83d Load-in | `cursor/vendor-load-in-428e` | `/vendor/load-in` |
| 83e Messaging UI | `cursor/messaging-ui-phase32-428e` | `/shopper/messages`, `/vendor/messages` (`RealtimeChatThread`) |
| 83f Flash promo | `cursor/low-stock-flash-promo-428e` | flash-sale libs + `FlashPromoService` (`/api/vendors/flash-promo`) |
| 83g Creator shell | `cursor/unified-shopper-creator-shell-428e` | `/creator/*` layout + mobile creator tabs |

## Apply SQL (after phase82)

```
docs/supabase/phase83a_home_private_chef_vendor_types.sql
docs/supabase/phase83b_vendor_connections.sql
```

(or `docs/supabase/migrations/20260721_phase83a_*` / `phase83b_*`)

Both scripts are idempotent (`add column if not exists`, `drop constraint if exists`).

### 83a — vendor personas

- Expands `vendors.vendor_type` check to include `home_kitchen`, `private_chef`, `micro_brand`
- Adds `cottage_food_disclosure`, private-chef rate/guest fields, micro-brand shipping fields
- Adds `products.has_variants` + `products.variants` jsonb

API tokens (`HOME`, `PRIVATE_CHEF`, `MICRO_BRAND`) map to snake_case DB values via `backend/src/modules/vendor-network/vendor-classification.ts`. Shared web/mobile helpers: `web/src/lib/vendor-types.ts`, `tenant-web/src/lib/vendor-types.ts`.

### 83b — V2V connections (distinct from phase64 wholesale peers)

| Table / API | Purpose |
|-------------|---------|
| `vendor_connections` (phase83b) | Profile-level V2V network: `pending` / `connected` / `ignored`, bidirectional follow flags |
| `vendor_peer_connections` (phase64) | Wholesale catalog peer edges for B2B discovery ranking |

Phase 83b also adds `products.visibility` (`public` | `connected_vendors` | `private`) with RLS gating wholesale SKUs to connected peers.

## Nest backend (`VendorNetworkModule`)

Registered in `backend/src/app.module.ts`. All routes require `SupabaseAuthGuard` + `@Roles('vendor')`.

### V2V connections — `V2vConnectionsController`

Base path: `/api/v2v/connections`

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `POST` | `/` | `{ receiverVendorId: uuid }` | Creates or reopens `pending` request |
| `GET` | `/` | — | Lists connections for authenticated vendor |
| `POST` | `/:id/accept` | — | Receiver only; status → `connected` |
| `POST` | `/:id/ignore` | — | Receiver only; status → `ignored` |

Error tokens use `V2V_ERROR:` / `V2V_VALIDATION_ERROR:` prefixes (e.g. `CONNECTION_ALREADY_PENDING`, `ONLY_RECEIVER_CAN_ACCEPT`).

### Flash promo — `FlashPromoController`

Base path: `/api/vendors/flash-promo`

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/` | — | Returns active campaign from `vendors.theme_settings.flash_sale` |
| `POST` | `/` | `{ productId, unitsLeft, discountPercent?, expiresAt? }` | Creates campaign; discount clamped 1–90% (default 15%) |
| `DELETE` | `/` | — | Clears `flash_sale` + `featured_highlight` from theme |

Low-stock walk-up threshold: 5 units (`LOW_STOCK_WALK_UP_THRESHOLD`). Shared logic: `backend/src/modules/vendor-network/flash-promo.util.ts`, mirrored in `web/src/lib/flash-sale.ts` and `tenant-web/src/lib/flash-sale.ts`.

## Web / tenant-web / mobile surfaces

| Route / file | Track |
|--------------|-------|
| `/admin/mix-analytics`, `/admin/analytics` | 83c |
| `/vendor/load-in`, `/vendor/fulfillment-settings` | 83d + 83a fulfillment |
| `/shopper/messages`, `/vendor/messages` | 83e |
| `/creator/*` (web), `mobile/app/creator/*` | 83g |
| `web/src/lib/mix-analytics.ts`, `load-in.ts`, `flash-sale.ts` | shared libs |

Tenant-web mirrors several routes under `tenant-web/src/app/` (API routes + pages).

## Verify

```bash
npm run build:web
npm run build:tenant-web
npx tsc --noEmit --prefix mobile
npm run test:phase83:amend
```

Included in full-stack gate: `npm test` (runs Phase 83 as the final suite).

Success lines (uppercase, no emoji):

- `PHASE83_AMEND_INITIALIZED`
- `DEFERRED_FEATURES_PORTED`
- `PHASE83_AMEND_VERIFIED`

See [`docs/VERIFICATION_AND_TESTING.md`](VERIFICATION_AND_TESTING.md) for the full test matrix.

## Follow-ups (not in this amend)

- Wire flash-promo UI into existing storefront/dashboard call sites
- Deep-link vendor nav tabs for load-in / messages
- Reconcile onboarding `vendor_type` picker with phase83a check constraint
- Delete source branches after this PR is on `main`
