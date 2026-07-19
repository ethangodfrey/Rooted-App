# Post-phase41 release runbook — Supabase + Vercel

**Baseline commit:** `e0ae644` (PR #52 merged — regional markets RLS, settlement charts)  
**Prerequisite:** `docs/supabase/phase41_stripe_webhook_events.sql` already applied in remote Supabase.

This runbook coordinates **remote Supabase migrations** and the **Vendorly_Marketplace1** production web deploy after the phase41 release window clears.

---

## Part A — Remote Supabase SQL (manual, in order)

Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**. Run each file **in sequence**. Re-running idempotent scripts is safe (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

| Step | Script | Purpose |
|------|--------|---------|
| **A1** | `docs/supabase/phase42_regional_markets.sql` | Creates `regions`, `markets`, `vendor_market_registrations`; adds `orders.market_id`; RLS + `vendor_approved_market_ids()` |
| **A2** | `docs/supabase/phase42a_seed_markets_from_events.sql` | Populates `markets.event_id` from legacy `public.events` (required before backfill) |
| **A3** | `docs/supabase/phase42b_backfill_orders_market_id.sql` | Safe backfill of `orders.market_id` (never overwrites existing values) |

### A1 — `phase42_regional_markets.sql` validation

After execution, confirm objects exist:

```sql
select to_regclass('public.regions') as regions,
       to_regclass('public.markets') as markets,
       to_regclass('public.vendor_market_registrations') as vendor_market_registrations;

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'orders' and column_name = 'market_id';

select proname from pg_proc where proname = 'vendor_approved_market_ids';
```

**RLS spot-check** (should return rows — policies enabled):

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('regions', 'markets', 'vendor_market_registrations');
```

### A2 — Seed `markets.event_id` (gate for backfill)

**Do not run A3 until this passes:**

```sql
select count(*) as markets_with_event_bridge
from public.markets
where event_id is not null;
```

If `markets_with_event_bridge = 0`, run `phase42a_seed_markets_from_events.sql` (or your own regional seed) and re-check.

### A3 — `phase42b_backfill_orders_market_id.sql` safety guarantees

The script only updates rows where:

- `orders.market_id IS NULL` (never overwrites pre-existing `market_id`)
- `orders.event_id IS NOT NULL`
- matching `markets.event_id = orders.event_id`
- `markets.status = 'ACTIVE'`

**Pre-backfill audit:**

```sql
select
  count(*) filter (where market_id is not null) as already_linked,
  count(*) filter (where market_id is null and event_id is not null) as eligible_for_backfill
from public.orders;
```

**Post-backfill audit:**

```sql
select
  count(*) filter (where market_id is not null) as linked_orders,
  count(*) filter (where market_id is null and event_id is not null) as still_unlinked
from public.orders;
```

`still_unlinked` should drop to orders whose `event_id` has no active `markets` bridge row.

---

## Part B — Vercel production rollout

**Target when Hobby deploy quota resets:**

| Field | Value |
|-------|--------|
| **Vercel project** | `Vendorly_Marketplace1` |
| **Branch** | `main` |
| **Commit** | `e0ae644` (or latest `main` after pull) |
| **Build** | Root `vercel.json` → `npm run build --prefix web` |

See also: [`docs/VERCEL_PRODUCTION_PROJECT.md`](VERCEL_PRODUCTION_PROJECT.md)

### B1 — Pre-deploy

```bash
git checkout main
git pull origin main
git log -1 --oneline   # expect e0ae644 or newer with PR #52
cd web && npm run build
```

### B2 — Deploy

1. [vercel.com/dashboard](https://vercel.com/dashboard) → **Vendorly_Marketplace1**
2. **Deployments** → **Redeploy** latest `main` → **Production**  
   *(Or push an empty commit to `main` if Git auto-deploy is connected and quota allows.)*

### B3 — Production env (confirm before/after redeploy)

| Variable | Production value |
|----------|------------------|
| `VITE_SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `VITE_API_URL` | `https://api.vendorlymarketplace.app` |
| `VITE_APP_URL` | `https://vendorly-marketplace1.vercel.app` or custom domain |

### B4 — Post-deployment verification (settlement charts)

1. Log in as a **vendor** with fulfilled/completed orders on production.
2. Navigate: **Vendor → Analytics → Market settlement**
3. Confirm:
   - **Metric cards** — gross volume, platform fee, net payout (integer-cent math)
   - **Gross volume trend** — daily/weekly bars from live `orders`
   - **Platform fee split** — stacked net + fee bars
   - **Volume by order size** — Under $10 … $100+ buckets
   - **Loading** — `SettlementSkeleton` (7 bars × 2 panels) on slow network
   - **Empty state** — graceful placeholders when no fulfilled orders

4. Optional API boundary smoke:

```bash
API_BASE=https://api.vendorlymarketplace.app npm run smoke:boundaries
```

---

## Part C — Rollout command summary

### Git / remote cleanup (already done for PR #52)

```bash
gh pr ready 52 && gh pr merge 52 --merge --delete-branch
git checkout main && git pull origin main
git fetch --prune origin
```

### Local baseline check

```bash
cd backend && npm run schema:sync
cd ../web && npm run build && npm run preview
```

---

## Rollback notes

- **Supabase:** Phase42 tables are additive. Do not drop in production without a maintenance window. `orders.market_id` is nullable — legacy `event_id` flows remain valid.
- **Vercel:** Redeploy a prior Production deployment from the Vercel dashboard if the web release must be reverted.
- **Backfill:** `phase42b` does not overwrite `market_id`; re-running is idempotent for still-null rows only.

---

## Related docs

- [`docs/VENDORLY_MIGRATION.md`](VENDORLY_MIGRATION.md) — full phase script list
- [`agent-os/standards/database/supabase-migrations.md`](../agent-os/standards/database/supabase-migrations.md) — apply order
- [`docs/PRODUCTION_BOUNDARY_CHECKLIST.md`](PRODUCTION_BOUNDARY_CHECKLIST.md) — Railway CORS + smoke tests
