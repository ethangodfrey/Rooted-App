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
