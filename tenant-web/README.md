# tenant-web — Vendorly edge gateway

**Standalone Next.js Vercel project.** Not part of the main `web/` Vite build.

## Deploy

1. Create or open a **separate** Vercel project.
2. Set **Root Directory** = `tenant-web/`.
3. Connect Git branch `main` (or deploy manually).
4. Copy env vars from `.env.example`.

```bash
# Local
cd tenant-web && npm install && npm run dev

# Production build (same command Vercel runs)
npm run build --prefix tenant-web
```

## API routes

| Route | Purpose |
|-------|---------|
| `/api/integration/connect` | POS OAuth redirect (Square, Clover) |
| `/api/integration/callback` | OAuth token exchange → `vendor_pos_connections` |
| `/api/markets/nearby` | PostGIS national farmers market search |
| `/api/webhooks/pos-sync` | POS inventory webhook ingest |
| `/api/webhooks/pos-sales` | POS sales ledger webhook ingest (Phase B) |
| `/api/checkout/initiate` | Checkout edge pipeline |

## POS sales pipeline (Phase B/C)

Sales webhooks ACK fast at the edge, enqueue to BullMQ, and are consumed by the **Railway backend** (not this Next.js process).

```
Square/Toast/Clover
  → POST /api/webhooks/pos-sales   (signature verify, parse, enqueue)
  → BullMQ pos-sales-ingest        (Upstash REDIS_URL)
  → backend PosSalesIngestProcessor → pos_transactions
  → BullMQ pos-snapshot-rollup    (5s debounce per vendor/market/day)
  → backend PosSnapshotRollupProcessor → market_sales_snapshots
```

### Required env vars (sales)

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Upstash TCP — same store as backend (`rediss://…`) |
| `POS_SALES_WEBHOOK_URL` | Public URL registered with Square (byte-for-byte match for HMAC) |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square webhook signing key |
| `SUPABASE_SERVICE_ROLE_KEY` | OAuth callback upserts to `vendor_pos_connections` |

Optional dev bypass when Redis is unavailable: `POS_SALES_WEBHOOK_TEST_MODE=true` (returns 200 without enqueueing).

### Register Square webhooks

In Square Developer Dashboard → Webhooks, add a subscription pointing to:

```
https://<your-tenant-gateway>/api/webhooks/pos-sales
```

Inventory events stay on `/api/webhooks/pos-sync` — do not mix sales and inventory in one route.

### Validation

```bash
# From repo root — seeds test vendor, posts mock Square webhook, runs workers
npx tsx scripts/e2e-phase-c-pipeline.ts
```

Backend must have `POS_QUEUES_ENABLED=true` + `SUPABASE_SERVICE_ROLE_KEY` in production. See [`docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md`](../docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md).

## Web app integration

Set on **Vendorly_Marketplace1** (optional):

```env
VITE_TENANT_WEB_URL=https://your-tenant-gateway.vercel.app
```

If unset, the web app falls back to Supabase RPC for nearby markets.

See [`docs/VERCEL_MULTI_PROJECT.md`](../docs/VERCEL_MULTI_PROJECT.md).
