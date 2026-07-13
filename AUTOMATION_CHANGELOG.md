# Automation Changelog

Automated summaries of incoming code changes for project-owner review. Newest entries appear at the top.

---

## 2026-07-13 — POS sales webhook pipeline (Phase B/C) + Phase 44 schema

| Field | Value |
|-------|-------|
| **Branch** | `cursor/automated-changelog-summary-76af` |
| **Base** | `main` @ `71b83fa` |
| **Head** | `06efcf7` |
| **Commits reviewed** | 8 (`124d5c7` → `06efcf7`) |
| **Files changed** | 33 files, +3,463 / −56 lines |
| **PRs merged** | #66 (Phase 44 schema), #68 (webhook transaction scaffold) |

### Summary

This batch delivers the **Vendorly POS sales ingest → ledger → daily rollup** pipeline, bridging Square (and stubbed Toast/Clover) webhooks into the Phase 43/44 `pos_transactions` / `market_sales_snapshots` data model. It also lands the **Phase 44 Supabase schema** for national harvester geo/schedules and analytics rollups, plus a **live transaction feed** on the vendor dashboard.

---

### Features & components altered

#### Database / Supabase (Phase 44)

| Area | Change |
|------|--------|
| **Schema migrations** | `docs/supabase/phase44_national_harvester_pos_analytics.sql`, `phase44c_national_harvester_pos_analytics_rls.sql` |
| **`markets` table** | Extended with `zip_code`, `operating_schedules` (jsonb), `national_farmers_market_id`, `tenant_id`, generated PostGIS `coordinates` |
| **`market_sales_snapshots`** | New daily rollup table + `upsert_market_sales_snapshot()` RPC |
| **POS connection tables** | Tenant-routing columns on `pos_connections` / `vendor_pos_connections` |
| **Migration docs** | `docs/supabase/PHASE44_SCHEMA_REVIEW.md`, updates to `docs/VENDORLY_MIGRATION.md`, `agent-os/standards/database/supabase-migrations.md` |

#### POS sales webhook pipeline (Phase B)

| Layer | Files / routes | Role |
|-------|----------------|------|
| **Edge gateway (`tenant-web`)** | `POST /api/webhooks/pos-sales` | Signature verify → parse → BullMQ enqueue (<200 ms ACK) |
| **Sales queue** | `tenant-web/src/lib/pos/sales-queue.ts` | Enqueues `pos-sales-ingest` jobs via `REDIS_URL` |
| **Provider parsers** | `sales/providers/square.ts` (full), `toast.ts` / `clover.ts` (stubs) | Normalize provider payloads → `NormalizedSalesEvent` |
| **Router** | `sales/router.ts`, `sales/types.ts` | Provider resolution + event filtering |
| **Backend ingest** | `PosSalesIngestProcessor`, `PosSalesIngestService`, `PosLedgerWriterService`, `PosMarketResolverService` | Resolve vendor/market, idempotent write to `pos_transactions` |
| **Design doc** | `docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md` | Full architecture blueprint (334 lines) |

#### POS snapshot rollup (Phase C)

| Layer | Files | Role |
|-------|-------|------|
| **Rollup worker** | `processors/pos-snapshot-rollup.processor.ts`, `PosSnapshotRollupService` | Debounced (5 s) `pos-snapshot-rollup` jobs → `upsert_market_sales_snapshot()` RPC + tender mix PATCH |
| **Tender aggregation** | `utils/tender-aggregation.ts` (+ spec) | Ledger scan → `tender_breakdown` + `payment_method_distribution` synthesis |
| **Job orchestration** | `PosSalesJobsService`, `pos-sales-queue.constants.ts` | Two-queue pipeline; Upstash-safe job IDs (`ingest-{provider}-{eventId}`) |
| **E2E validation** | `scripts/e2e-phase-c-pipeline.ts` | End-to-end Phase C pipeline test script (530 lines) |

#### Vendor web UI

| Component | Change |
|-----------|--------|
| **`VendorDashboardPage`** | Wired to `usePosLedger` hook; displays POS KPIs + live feed |
| **`PosLiveTransactionFeed`** | New component — realtime status badge, last 12 transactions, empty/loading states |

#### Data / scripts

| Script | Change |
|--------|--------|
| `backend/scripts/national-market-backfill-link.ts` | New — links regional `markets` to national registry |
| `scripts/ingest-national-farmers-markets.ts` | Updated harvester ingest logic |

#### Deploy / configuration

| File | Change |
|------|--------|
| `backend/.env.example` | Added `SUPABASE_SERVICE_ROLE_KEY` (required for ledger writes + rollup RPC) |
| `tenant-web/.env.example` | Added `POS_SALES_WEBHOOK_URL` |
| `tenant-web/README.md` | Documented `/api/webhooks/pos-sales` route |

---

### Dependencies added or removed

| Category | Result |
|----------|--------|
| **npm packages** | **None** — no `package.json` or lockfile changes in this diff |
| **Existing deps reused** | `bullmq` (^5.34), `ioredis` (^5.11), `@nestjs/bullmq` (^11), `@upstash/redis` (^1.34) |
| **New runtime requirements** | `REDIS_URL` (Upstash TCP), `POS_QUEUES_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY` on backend workers |
| **New webhook config** | `POS_SALES_WEBHOOK_URL` registered separately in Square Developer Dashboard |

---

### Performance & structural risk assessment

| Risk area | Level | Notes |
|-----------|-------|-------|
| **Edge webhook latency** | 🟢 Low | Route only verifies, parses, and enqueues — designed for <200 ms ACK. Returns 503 if Redis unavailable (unless test-mode bypass). |
| **Queue throughput** | 🟢 Low | Idempotent job IDs prevent duplicate ingest; 5 s rollup debounce coalesces burst traffic per vendor/market/day. |
| **Rollup DB load** | 🟡 Medium | Each rollup job re-scans all `pos_transactions` for the vendor's UTC day to synthesize tender mix. Acceptable at current scale; may need incremental aggregation if transaction volume grows. |
| **Dual POS pipelines** | 🟡 Medium | Legacy Nest path (`pos_imported_transactions` / `analytics_snapshots`) still coexists with the new Phase 43/44 path. Design doc calls for eventual unification; no production traffic wired yet (scaffold status). |
| **Provider coverage** | 🟡 Medium | Square parser is complete; Toast and Clover parsers are stubs returning `null`. Non-Square providers will be ignored until implemented. |
| **Schema prerequisite** | 🟡 Medium | Phase 44 SQL must be applied in Supabase before rollup RPCs work. Rollup service throws if `SUPABASE_SERVICE_ROLE_KEY` is missing. |
| **Upstash job IDs** | 🟢 Resolved | Prior `provider:eventId` format rejected colons; fixed to `ingest-{provider}-{eventId}` format in `pos-sales-queue.constants.ts`. |
| **Service-role key exposure** | 🟡 Medium | Backend now requires `SUPABASE_SERVICE_ROLE_KEY` for worker writes. Must be scoped to Railway/backend only — never exposed to client bundles. |
| **Vendor dashboard realtime** | 🟢 Low | `PosLiveTransactionFeed` uses existing Supabase realtime subscription pattern; capped at 12 items, graceful reconnect states. |
| **Build / smoke impact** | 🟢 Low | Changes are additive (new routes, backend modules, SQL docs). No modifications to isolated build scripts or smoke auditors. |

### Recommended follow-ups for project owner

1. Apply Phase 44 SQL (`phase44` → `phase44c`) in Supabase SQL Editor if not already done.
2. Set production env vars: `REDIS_URL`, `POS_QUEUES_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY` on Railway backend; `POS_SALES_WEBHOOK_URL` + `REDIS_URL` on Vercel tenant-web.
3. Register Square sales webhook URL pointing to `/api/webhooks/pos-sales`.
4. Run `npx tsx scripts/e2e-phase-c-pipeline.ts` against staging to validate the full ingest → ledger → rollup path.
5. Implement Toast/Clover sales parsers before enabling those providers in production.

---
