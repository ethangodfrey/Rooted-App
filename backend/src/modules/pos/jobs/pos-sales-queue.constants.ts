/** BullMQ queue names and job identifiers for POS sales ingest + snapshot rollup. */

export const POS_SALES_INGEST_QUEUE = 'pos-sales-ingest';
export const POS_SALES_INGEST_JOB = 'ingest-sales-webhook';

export const POS_SNAPSHOT_ROLLUP_QUEUE = 'pos-snapshot-rollup';
export const POS_SNAPSHOT_ROLLUP_JOB = 'rollup-vendor-market-day';

/** Debounce window before calling upsert_market_sales_snapshot (ms). */
export const SNAPSHOT_ROLLUP_DEBOUNCE_MS = 5_000;

/** BullMQ-safe job id (Upstash rejects ':' in custom ids). */
export function salesIngestJobId(provider: string, providerEventId: string): string {
  return `ingest-${provider}-${providerEventId}`;
}

export function snapshotRollupJobId(
  vendorId: string,
  marketId: string,
  snapshotDate: string,
): string {
  return `rollup-${vendorId}-${marketId}-${snapshotDate}`;
}
