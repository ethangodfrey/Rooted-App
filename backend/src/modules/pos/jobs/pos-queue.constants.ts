export const POS_SYNC_QUEUE = 'pos-sync';
export const POS_AGGREGATION_QUEUE = 'pos-aggregation';

export const POS_JOBS = {
  /** Run a single connection sync (incremental or backfill). */
  SYNC_CONNECTION: 'sync-connection',
  /** Recompute analytics rollups for a vendor over a date range. */
  AGGREGATE_VENDOR: 'aggregate-vendor',
} as const;

export interface SyncConnectionJobData {
  connectionId: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'BACKFILL';
  /** Pre-created sync run row to attach this execution to. */
  syncRunId: string;
  /** ISO lower bound override; when absent the service derives the window. */
  since?: string;
  until?: string;
}

export interface AggregateVendorJobData {
  vendorId: string;
  /** Dates (YYYY-MM-DD) whose snapshots should be recomputed. */
  dates: string[];
}
