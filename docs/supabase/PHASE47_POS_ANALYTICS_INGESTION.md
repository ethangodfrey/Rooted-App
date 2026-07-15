# Phase 47 — POS analytics ingestion

Platform-agnostic sales schema + NestJS Square transformer for the analytics dashboard.

## Naming (why not the bare names)

| Requested | Actual | Reason |
|-----------|--------|--------|
| `pos_connections` | `vendor_pos_connections` + view `pos_analytics_connections` | Legacy Nest already owns `pos_connections` (phase12) |
| `transactions` | `pos_analytics_transactions` | `public.transactions` is Stripe checkout (phase36) |
| `transaction_items` | `pos_analytics_transaction_items` | Avoid generic collision |

Money columns are **integer cents**. Upsert key: `(provider, external_transaction_id)`.

Composite index: `(vendor_id, transaction_created_at DESC)`.

## Apply

```sql
-- Supabase SQL Editor, after phase46
\i docs/supabase/phase47_pos_analytics_ingestion.sql
```

Mirrored at `supabase/migrations/20260715194500_phase47_pos_analytics_ingestion.sql`.

## TypeScript

| Piece | Path |
|-------|------|
| Interfaces | `backend/src/modules/pos/types/analytics-transaction.ts` |
| Square mapper | `backend/src/modules/pos/mappers/square-analytics.mapper.ts` |
| Upsert service | `backend/src/modules/pos/services/pos-analytics-ingest.service.ts` |

### Wire-up (already done in module)

1. Register `PosAnalyticsIngestService` in `PosModule` providers.
2. `PosSalesIngestService` calls `PosAnalyticsIngestService` **after a successful ledger write** (`result?.id`); Square uses `ingestSquarePayload`, others use `upsertTransaction`. Failures are non-fatal.
3. `pos-sales-ingest.processor.ts` logs `phase47=${result.analyticsTxnWritten}`.
4. Env required on Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Direct usage (Square poll / one-off)

```ts
// After resolving vendor + connection
await analyticsIngest.ingestSquareOrder(squareOrderJson, {
  vendorId,
  posConnectionId: connection.id,
  provider: 'square',
});

// Or payment (+ optional order)
await analyticsIngest.ingestSquarePayment(paymentJson, context, orderJson);

// Or already-mapped unified Transaction
await analyticsIngest.upsertTransaction(txn);
```

Optional: from Nest poll sync (`PosImportService` / `PosSyncService`), after `NormalizedTransaction` import, call `mapSquareOrderToTransaction` + `upsertTransaction` to dual-write analytics tables.

## Toast / Clover

Use the same `Transaction` / `TransactionItem` shapes and `upsertTransaction`. Add mappers beside `square-analytics.mapper.ts` when those adapters are ready; the webhook path already falls back to a header-only upsert for non-Square providers.
