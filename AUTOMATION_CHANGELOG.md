# Automation Changelog

Automated weekly summaries of incoming code changes on `main`, produced by cron automation `400acac4-7bf0-11f1-ba66-0e7d0216e441`.

---

## 2026-07-20 — Weekly review (`06efcf7` → `2bea704`)

**Scope:** 230 commits · 549 files changed · +56,428 / −2,825 lines  
**Period:** 2026-07-13 through 2026-07-20  
**PRs merged:** #75–#208 (major feature stack)

### Summary

This week delivered the largest single batch of changes since the POS analytics baseline: a full **B2B wholesale marketplace** (catalog → fulfillment → invoicing → Stripe settlement), **nationwide directory geo-routing**, **orders table partitioning**, **Elasticsearch-backed discovery**, **logistics/shipping middleware**, and substantial **infrastructure hardening** (CI, env guardrails, domain migration, deploy smoke harnesses). The wholesale vertical is now end-to-end testable via 20+ new root-level verification scripts.

---

### 1. Features & components altered

#### Database / Supabase schema (28 new phase scripts)

| Phase range | Area | Key changes |
|-------------|------|-------------|
| 45–47 | POS analytics | Webhook audit logs, Square analytics ingestion, encrypted OAuth credentials |
| 48 | Orders / storefront | Pickup codes, market-date slots |
| 49 | Payments | SNAP/EBT discovery, Stripe policy |
| 50–52 | Social graph | Role stickers, vendor network tables, profile specialties |
| 53 | Nationwide directory | Geo-spatial market routing, PostGIS indexes |
| 54–65 | B2B wholesale | Vendor connections, product catalog, order drafts, acceptance, fulfillment, delivery settlement, Net-30 invoices, Stripe payments, peer connections, retail pricing |
| 68a–68b | Orders partitioning | Monthly `RANGE` partitioning on `orders` / `order_items` by `created_at`; safe cutover + recovery scripts |

#### Backend (`backend/`)

| Module | Changes |
|--------|---------|
| **B2B** | New `b2b` module: wholesale orders/products/invoices controllers, peer connection requests, relationship middleware (tiered pricing), Net-30 overdue sweeper cron, A/R metrics, isolation audit contracts |
| **Search / Discovery** | Elasticsearch client + wholesale product indexer; US geo-spatial proximity middleware; relationship-aware hybrid ranking; partition-aware partial indexing; hourly production sync cron (`DISCOVERY_PARTITION_SYNC_CRON_ENABLED`); query pruning + latency telemetry |
| **Orders** | Handoff verification service, partition strategy utilities, partition migration helpers |
| **Logistics** | `LogisticsService`, regional freight carrier mock, US route middleware, shipping-options endpoint |
| **Markets** | Nationwide directory service, nearby markets controller, geo-query profiling (`GEO_QUERY_PROFILE`) |
| **POS** | Analytics webhook ingest, Square analytics mapper, admin simulate-swipe, sales webhook signature key support |
| **Admin agent** | Community event AI verification, event ingestion pipeline, local network seed runner |
| **Health** | Expanded DB/API health probes, safe error surfacing |
| **Checkout** | Minor integration hooks for wholesale flows |

#### Web (`web/`)

| Area | Changes |
|------|---------|
| **Vendor portal** | New pages: B2B chat, inbox, network, inventory, payments (Stripe Connect), handoffs, wholesale fulfillment; expanded analytics, events, POS dashboards |
| **Shopper** | Explore menu drawer, community event pins, SNAP vendor discovery |
| **Map** | Viewport bounds RPC, producer pin clustering, coordinate hardening, error boundaries |
| **UI/UX** | Zinc fintech design system, bento/split-pane layout, day/night theme toggle (`theme-provider`) |
| **Notifications** | Realtime notification center provider |
| **Testing** | Vitest wired; utility unit tests expanded |

#### Tenant-web (`tenant-web/`)

| Area | Changes |
|------|---------|
| **Multi-tenant routing** | 50-state geo validation, subdomain fallback guards, edge error boundaries |
| **B2B wholesale portal** | Catalog, connection UI, order drafts, fulfillment, invoices, A/R metrics API routes |
| **POS** | Analytics dashboard (recharts), Square OAuth callback routes, POS sales webhooks |
| **Stripe** | Connect onboard/status API routes |

#### Mobile (`mobile/`)

| Area | Changes |
|------|---------|
| **Wholesale** | Touch-optimized order entry, offline-first catalog cache (`@react-native-community/netinfo`) |
| **Handoffs** | Secure RT-xxx verify engine, offline handoff queue + sync worker |
| **Navigation** | Vendor wholesale tab, handoffs screen |

#### Scripts & CI

- New `packages/env-config` workspace package (Zod-based env guardrails shared across backend + tenant-web)
- CI pipeline engine for `main` branch protection
- 30+ integration verification scripts (`test:wholesale:*`, `test:discovery:*`, `test:orders:partition-*`, `verify:ingress`, `verify:domains`, deploy resilience harnesses)
- Local network Denver stress-testing seed engine

#### Domain / deploy

- Canonical routing migrated to `vendorlymarketplace.com` / `.app`
- Production ingress alignment + cutover verification utilities
- Railway deploy manifests, live stack smoke harness
- Docker base image upgraded to `node:22-alpine`

---

### 2. Dependencies added or removed

#### Added

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `@elastic/elasticsearch` ^8.19.2 | `backend` | Wholesale catalog indexing + discovery search |
| `@vendorly/env-config` (workspace) | `backend`, `tenant-web` | Shared Zod env validation |
| `zod` ^3.24.2 | `packages/env-config` | Runtime env guardrails |
| `lucide-react` ^0.511.0 | `web` | Icon set for new vendor UI |
| `vitest` ^3.2.4 | `web` (dev) | Unit test runner |
| `recharts` ^2.15.4 | `tenant-web` | POS analytics dashboard charts |
| `tailwindcss`, `postcss`, `autoprefixer` | `tenant-web` (dev) | Styling for new portal pages |
| `@react-native-community/netinfo` 11.4.1 | `mobile` | Offline wholesale catalog detection |

#### Removed

No production runtime dependencies were removed. Script renames only (`seed:stress-transactions` consolidated under network seed).

#### New workspace package

- `packages/env-config` — strict typed env parsing for server and edge surfaces

---

### 3. Performance & structural risk assessment

| Area | Risk level | Notes |
|------|------------|-------|
| **Orders partitioning (68a/68b)** | **High** | Monthly `RANGE` partition cutover on `orders` / `order_items` requires coordinated SQL apply + index maintenance. Recovery scripts exist but downtime or query-plan regressions are possible if applied out of order. Run `test:orders:partition-strategy` and `test:orders:partition-migration` before production cutover. |
| **Elasticsearch discovery sync** | **Medium** | Hourly cron (`EVERY_HOUR`) partial-reindexes recent partitions. Errors are swallowed to protect the Nest process, which can mask stale search results. Requires `ELASTICSEARCH_URL` (or equivalent) in production. Gate via `DISCOVERY_PARTITION_SYNC_CRON_ENABLED`. |
| **B2B wholesale stack** | **Medium** | Large new surface area (10+ controllers, 750-line order service). Net-30 overdue sweeper and Stripe PaymentIntent settlement touch money flows — verify with `test:wholesale:stripe-payment` and `test:wholesale:overdue`. |
| **Nationwide geo routing** | **Medium** | PostGIS queries across 50 states; `GEO_QUERY_PROFILE` flag available for index-scan audits. Monitor query latency after phase53 apply. |
| **Monorepo size (+56k lines)** | **Medium** | Build times and CI duration will increase. New root `build` script chains `env-config` + backend. Validate `npm run build:web` and `npm run build:tenant-web` before deploy. |
| **Domain migration** | **Low–Medium** | DNS/ingress cutover to `.com`/`.app` domains; verification scripts provided (`verify:domains`, `verify:ingress`). |
| **UI redesign** | **Low** | Visual-only fintech theme + layout changes; no schema impact. |
| **Mobile offline cache** | **Low** | NetInfo-gated catalog cache; stale-data window possible on reconnect. |

#### Recommended pre-deploy checklist

1. Apply Supabase phases **45 → 65 → 68a → 68b** in order (see `docs/supabase/`)
2. Set env vars: `ELASTICSEARCH_URL`, `DISCOVERY_PARTITION_SYNC_CRON_ENABLED`, Stripe Connect keys, `REDIS_URL`
3. Run: `npm run build:web && npm run build:tenant-web && npm run smoke:ui-baseline`
4. Run partition + discovery verification scripts before enabling production cron
5. Redeploy **Vendorly_Marketplace1** (Vercel) from `main`

---

*Generated automatically on 2026-07-20T15:02Z by Cursor Cloud Agent.*

---

## 2026-07-27 — Weekly review (`2bea704` → `1af174f`)

**Scope:** 78 commits · 383 files changed · +42,502 / −692 lines  
**Period:** 2026-07-20 through 2026-07-22  
**PRs merged:** #166, #194–#198, #203, #209–#210, #220–#224, #238–#248

### Summary

This week landed the **platform stack Phases 2–9** (availability → loyalty → financial clearing → fleet logistics → Stripe escrow → admin dashboard → disputes → notifications), a **Phase 83 deferred-features amend** (home/private-chef vendor types, V2V connections, mix analytics, load-in, messaging, flash promo, creator shell), and substantial **stability / UX hardening** after bulk PR merges. The diff also adds **32 new verification scripts**, a **full-stack Phase 4–9 runner**, and **platform E2E golden-path smoke**. Money-adjacent flows (escrow ledger, Stripe Connect, dispute freeze) are now wired end-to-end but require coordinated SQL apply and env setup before production.

---

### 1. Features & components altered

#### Database / Supabase schema (phases 66–83b)

| Phase range | Area | Key changes |
|-------------|------|-------------|
| 66 | Wholesale catalog | `wholesale_sale_mode_preference` enum (`WHOLESALE_ONLY` / `RETAIL_ONLY` / `BOTH`) on `wholesale_products` |
| 67 | Supplier analytics | `vendor_alerts` table (`LOW_STOCK`, `PAYMENT_DELAY`) |
| 69 | Notifications | Location-aware market alert radius columns |
| 70 | Content | Dual-posting `post_contributions` + interaction metrics |
| 71 | Discovery | Meet the Makers `user_events` + RSVP schedule |
| 72 | Catering | Optional vendor catering services module |
| 73 | Analytics | `engagement_metrics` + interaction columns on posts/inquiries |
| 74 | Intelligence | `partner_reports` + automated anomaly/weekly reporting |
| 75 | B2B marketplace | `wholesale_listings`, procurement requests, availability + loyalty prep |
| 76 | Loyalty | Precision Rewards: action points, boosts, redemptions |
| 77 | Availability | Catering inquiry conflict detection (`PENDING_REVIEW`, conflict flags) |
| 78 | Financial | `financial_transactions` + `vendor_balances` escrow ledger |
| 79 | Fleet logistics | `delivery_routes`, `delivery_stops`, `farmer_balances` |
| 80 | Payments | Stripe Connect `stripe_account_id` on vendors/farmers |
| 81 | Disputes | `disputes` table + `FROZEN` escrow status |
| 82 | Notifications | `notifications_log` + `notification_preferences` on users |
| 83a | Vendor types | Home / Private Chef / Micro-Brand `vendor_type` check constraint |
| 83b | Vendor network | `vendor_connections` V2V peer graph (idempotent column adds) |

#### Backend (`backend/`)

| Module | Changes |
|--------|---------|
| **Availability** | Automated scheduling service; catering inquiry conflict wiring |
| **Loyalty** | Precision Rewards ticks/boosts/redemptions; redemption rules |
| **Financial** | Payment clearing, escrow ledger, dynamic invoice generation |
| **Logistics** | Fleet fulfillment controller/service; B2B escrow loop |
| **Stripe** | Connect payment gateway, onboarding service, API payments controller |
| **Disputes** | Dispute resolution engine with escrow freeze |
| **Notifications** | Phase 9 engine (email/SMS mocks), market-notification service, location-aware alerts |
| **Admin dashboard** | Platform telemetry, fleet overview, mix analytics API |
| **B2B** | Peer marketplace Phase 1, catalog bulk-import + CSV parser, wholesale products |
| **Supplier analytics** | Demand forecast, vendor alerts, A/R analytics |
| **Discovery** | Meet the Makers feed, USDA enrichment, user-events service |
| **Content** | Dual-posting contributions + sync-health observability cron |
| **Catering** | Optional vendor catering module |
| **Analytics / Intelligence** | Engagement reporting, weekly partner reports, anomaly detection |
| **Vendor network** | V2V connections, flash promo service |
| **Search** | `sale_mode_preference` indexing + role-based discovery filter |

#### Web (`web/`)

| Area | Changes |
|------|---------|
| **Shopper** | Rewards/redemption UI, Meet the Makers, chef booking, events, messages |
| **Vendor** | Procurement dashboard, financials, availability, catering settings, loyalty, analytics (recharts), network, load-in |
| **Farmer** | Fleet logistics dispatch dashboard |
| **Admin** | Platform dashboard, mix analytics, credentials |
| **Creator** | Unified creator shell (`/creator/*`) with handoffs, listings, settings |
| **Map** | Coordinate sanitization, `MapContainer` center guard |
| **Messaging** | `RealtimeChatThread` for shopper/vendor messages |
| **UI/UX** | Responsive layouts, skeleton loaders, image fallbacks, form validation |
| **Hooks** | Fixed stuck loading/pending states and stale fetch races |

#### Tenant-web (`tenant-web/`)

| Area | Changes |
|------|---------|
| **B2B** | Business connection panel, P2P connection request API |
| **Vendor** | Load-in dashboard, flash-promo API, low-stock alerts, messages |
| **Admin** | Mix analytics dashboard + API route |
| **Shopper** | Messages page |
| **Explore** | Vendor-types API route |

#### Mobile (`mobile/`)

| Area | Changes |
|------|---------|
| **Creator** | New creator tab shell (handoffs, listings, settings) |
| **Vendor** | Post form updates, video post flow, vendor connections lib |
| **Shopper** | Event detail improvements |
| **Types** | `database.ts` / `profiles.ts` aligned with Phase 83 vendor types |

#### Scripts, CI & testing

- **32 new `verify-*.ts` scripts** covering phases 4–9, loyalty, financial, logistics, payments, admin, disputes, notifications, catering, content, discovery, health regression
- Root `npm test` / `npm run test:full-stack` — Phase 4–9 full-stack verification runner
- `npm run test:e2e:platform` — Jest golden-path E2E (`backend/test/platform.e2e-spec.ts`)
- `npm run test:all` — health/efficiency regression aggregator
- `npm run test:phase83:amend` — deferred-features amend verifier
- CI workflows: Supabase Vite env resolution from GitHub secrets (with placeholder fallback) across 4 workflow files
- Application security review branch merged (`cursor/application-security-review-afbb`)

#### Docs

- `docs/MAIN_COMPUTER_HANDOFF.md` — stacked PR apply order + SQL checklist through phase83
- `docs/PHASE83_DEFERRED_FEATURES_AMEND.md` — Phase 83a–83g surface map
- `docs/WHOLESALE_DISCOVERY_AND_PARTITIONING.md` — partition + discovery runbook updates

---

### 2. Dependencies added or removed

#### Added

| Package / script | Workspace | Purpose |
|------------------|-----------|---------|
| `recharts` ^2.15.4 | `web` | Vendor analytics + admin mix-analytics charts |
| `test:e2e:platform` script | `backend` | Platform golden-path Jest E2E |
| `typecheck` script | `mobile` | `tsc --noEmit` for CI |
| `test` / `test:full-stack` + 25 phase scripts | root `package.json` | Full-stack and per-phase verification runners |

#### Removed

No production runtime dependencies were removed.

#### Notable non-dependency changes

- Wholesale catalog create path now requires `saleModePreference` (Nest build fix)
- Post-merge module/schema restore commit (`#238`) — indicates merge-conflict risk on `app.module` and Prisma schema

---

### 3. Performance & structural risk assessment

| Area | Risk level | Notes |
|------|------------|-------|
| **Financial clearing + escrow ledger (phase78)** | **High** | New `financial_transactions` / `vendor_balances` tables touch money flows. Verify with `test:financial:clearing` and `test:financial:ui` before enabling production settlement. |
| **Stripe Connect gateway (phase80)** | **High** | PaymentIntent escrow checkout + onboarding UI. Requires live Stripe keys and `stripe_account_id` columns. Run `test:payments:stripe` + `test:payments:ui`. |
| **Dispute resolution + escrow freeze (phase81)** | **High** | `FROZEN` status can block payouts. Run `test:admin:disputes` and confirm dispute workflow in staging. |
| **Fleet logistics escrow loop (phase79)** | **Medium–High** | Delivery routes/stops + farmer balances. Cross-cuts B2B fulfillment. Run `test:logistics:fulfillment` + `test:logistics:ui`. |
| **Bulk PR merge / post-merge restore (#238)** | **Medium** | `fix: restore app modules and schema after bulk PR merges` signals merge-conflict fragility. Re-run `npm run build:web`, `npm run build:tenant-web`, and `npm run test:full-stack` after any rebase. |
| **Phase 83 SQL (83a/83b)** | **Medium** | Vendor type constraint + `vendor_connections` graph. Idempotent fix applied for 83b columns. Apply after phase82. |
| **Notification engine (phase82)** | **Medium** | Email/SMS mocks in dev; production needs provider keys (`RESEND_API_KEY`, etc.). Location-aware alerts add geo-query load. |
| **Precision Rewards (phase76)** | **Medium** | Ledger-based loyalty ticks/boosts; race conditions possible on concurrent redemptions. Run `test:loyalty:precision`. |
| **Map / fetch hook fixes** | **Low** | Coordinate sanitization and stale-fetch guards reduce runtime errors; no schema impact. |
| **UI polish (skeletons, fallbacks)** | **Low** | Visual/UX only; improves perceived performance. |
| **Monorepo size (+42k lines)** | **Medium** | CI duration and build times will increase. 32 new verify scripts add maintenance surface. |

#### Recommended pre-deploy checklist

1. Apply Supabase phases **66 → 83b** in order (see `docs/MAIN_COMPUTER_HANDOFF.md`)
2. Set env vars: Stripe Connect keys, `RESEND_API_KEY` (optional), `USDA_API_KEY` (Meet the Makers), notification provider keys
3. Run: `npm run build:web && npm run build:tenant-web && npm run smoke:ui-baseline`
4. Run: `npm run test:full-stack` (or individual `test:financial:*`, `test:payments:*`, `test:logistics:*`, `test:admin:*`, `test:notifications:*`)
5. Run: `npm run test:phase83:amend`
6. If orders partitioning from prior week not yet applied: run `test:orders:partition-strategy` before phase68 cutover
7. Redeploy **Vendorly_Marketplace1** (Vercel) from `main`

---

*Generated automatically on 2026-07-27T15:02Z by Cursor Cloud Agent.*
