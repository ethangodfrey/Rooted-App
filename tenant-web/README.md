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

## Web app integration

Set on **Vendorly_Marketplace1** (optional):

```env
VITE_TENANT_WEB_URL=https://your-tenant-gateway.vercel.app
```

If unset, the web app falls back to Supabase RPC for nearby markets.

See [`docs/VERCEL_MULTI_PROJECT.md`](../docs/VERCEL_MULTI_PROJECT.md).
