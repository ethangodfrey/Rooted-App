# Monorepo layout

| Path | Stack | Purpose |
|------|-------|---------|
| `web/` | Vite + React + TypeScript | Customer, vendor, chef, admin web app |
| `mobile/` | Expo SDK 54 + Expo Router + TypeScript | Same roles on iOS/Android |
| `backend/` | NestJS + Prisma + TypeScript | Markets, POS, admin agents, Stripe |
| `scripts/` | Node/tsx | USDA market seed/import pipelines |
| `docs/supabase/` | SQL | Phase migrations — apply in order |

**Product name:** Vendorly Marketplace (formerly Rooted). Farmers-market flows are legacy core; Vendorly marketplace features are additive — do not break them.

**Shared data:** Supabase Postgres + Auth + Storage. Web uses `VITE_SUPABASE_*`; mobile uses `EXPO_PUBLIC_SUPABASE_*`; backend uses `DATABASE_URL` + `SUPABASE_URL`.

**Types:** `web/src/types/database.ts` is the web source of truth; keep mobile types aligned when changing schema-facing shapes.
