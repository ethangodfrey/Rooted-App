# Farmers markets directory

Additive national directory table (`public.farmers_markets`) with PostGIS `geom` for radius queries. Complements phase43 `national_farmers_markets` (harvester target).

## Apply

```text
docs/supabase/farmers_markets_directory.sql
```

After phase46/47. Enables `postgis` if needed, creates GiST index `idx_farmers_markets_geom`.

## Seed

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run markets:seed-directory
# dry-run:
npm run markets:seed-directory:dry
# custom JSON array:
SEED_MARKETS_JSON=./path/markets.json npm run markets:seed-directory
```

`scripts/seed-markets.ts` formats coordinates as EWKT `SRID=4326;POINT(longitude latitude)` before bulk upsert.
Helpers: `scripts/lib/seed-markets.ts` (also re-exported from `scripts/lib/markets.ts` — import does not run the CLI).

Auth: prefers `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; falls back to `DATABASE_URL` (Postgres) when service-role is unset.

## POS analytics dashboard (tenant-web)

- API: `GET /api/analytics?vendorId=…` (Bearer required) → last 30 days of `pos_analytics_transactions`
- UI: `src/components/POSDashboard.tsx` — KPI cards + Recharts area chart
- Page: `/vendor/analytics?vendorId=…`
