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

## Verify

```bash
npm run build && npx tsc --noEmit && npm run test:phase83:amend
```

Success lines (uppercase, no emoji):

- `PHASE83_AMEND_INITIALIZED`
- `DEFERRED_FEATURES_PORTED`
- `PHASE83_AMEND_VERIFIED`

## Follow-ups (not in this amend)

- Wire flash-promo UI into existing storefront/dashboard call sites
- Deep-link vendor nav tabs for load-in / messages
- Reconcile onboarding `vendor_type` picker with phase83a check constraint
- Delete source branches after this PR is on `main`
