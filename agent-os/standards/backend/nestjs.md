# Backend (NestJS)

## Structure

- `backend/src/modules/` — feature modules (markets, pos, admin-agent, stripe, health, b2b, logistics, search, vendor-network)
- `backend/src/common/` — auth guards, crypto, redis, observability
- `backend/prisma/schema.prisma` — ORM schema (Supabase Postgres)
- Entry: `backend/src/main.ts` — CORS, validation pipe, raw body for webhooks

## B2B / wholesale modules

| Module | Key files | Purpose |
|--------|-----------|---------|
| `b2b` | `wholesale-products.controller.ts`, `vendor-peer-requests.controller.ts` | Catalog CRUD, peer connections, order lifecycle |
| `search` | `wholesale-discovery-search.service.ts`, `partition-aware-order-indexer.*` | ES-backed discovery ranking + hourly partition partial sync |
| `logistics` | `logistics.service.ts`, `logistics-shipping.controller.ts` | `GET /api/orders/:orderId/shipping-options` US freight routes |
| `orders` | `orders-partitioning.strategy.ts` | Phase68 monthly RANGE partition invariants (verify scripts) |
| `vendor-network` | `v2v-connections.*`, `flash-promo.*`, `vendor-classification.ts` | Phase83 V2V connections + flash promo campaigns |

Runbooks: `docs/WHOLESALE_DISCOVERY_AND_PARTITIONING.md`, `docs/PHASE83_DEFERRED_FEATURES_AMEND.md`.

## Modules pattern

Each module: `*.module.ts`, controllers, services, DTOs with `class-validator`. Register in `app.module.ts`.

## Auth

- `SupabaseAuthGuard` verifies JWT via JWKS (`SUPABASE_URL`)
- `@Roles()` decorator + `RolesGuard` for admin/vendor routes
- Legacy HS256: `SUPABASE_JWT_SECRET` (omit for ES256 projects)

## Jobs and cron

- BullMQ queues when `POS_QUEUES_ENABLED=true` + `REDIS_URL`
- Market/admin agents gated by `*_AGENT_ENABLED` env flags
- **Discovery partition sync** — `PartitionAwareOrderIndexerScheduler` hourly when `DISCOVERY_PARTITION_SYNC_CRON_ENABLED` is true (default on in production). See `docs/WHOLESALE_DISCOVERY_AND_PARTITIONING.md`.
- **Wholesale invoice overdue sweeper** — `WholesaleInvoiceOverdueScheduler` (phase62)

## Wholesale discovery env vars

| Variable | Default | Notes |
|----------|---------|-------|
| `ELASTICSEARCH_NODE` | unset | Skip ES sync when empty |
| `ELASTICSEARCH_WHOLESALE_INDEX` | `wholesale_products` | Catalog index name |
| `DISCOVERY_PARTITION_SYNC_CRON_ENABLED` | prod=true | Hourly order-activity partial index |
| `DISCOVERY_PARTIAL_INDEX_MONTHS` | `3` | Recent partitions scanned per sync |
| `CONNECTED_WHOLESALER_SCORE_MULTIPLIER` | `1.2` | Peer-connection ranking boost |
| `PROXIMITY_SCORE_WEIGHT` | `0.15` | Max proximity additive boost |
| `DEBUG_SEARCH_RANKING` | `false` | Per-hit score composition logs |

Verify: `npm run test:discovery:partition-indexing`, `npm run test:discovery:production-sync-cron`, `npm run test:orders:partition-strategy`.

## Build and run

```powershell
cd backend
npm run start:dev    # port 4000
npm run build
```

## Phase 83 vendor-network API

| Controller | Base path | Auth | Purpose |
|------------|-----------|------|---------|
| `V2vConnectionsController` | `/api/v2v/connections` | vendor | Request/accept/ignore profile-level V2V connections |
| `FlashPromoController` | `/api/vendors/flash-promo` | vendor | CRUD flash-sale campaigns in `vendors.theme_settings` |

Verify: `npm run test:phase83:amend`. Classification helpers map API tokens (`HOME`, `PRIVATE_CHEF`, `MICRO_BRAND`) to DB `vendor_type` snake_case.

## Health

- `/health/live` — liveness (Railway health check)
- `/health/ready` — DB + Redis readiness
