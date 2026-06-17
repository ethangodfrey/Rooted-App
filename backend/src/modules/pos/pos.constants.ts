export const POS_DEFAULTS = {
  /** Page size requested from providers when paginating transactions. */
  PAGE_SIZE: 100,
  /** How far back an initial backfill reaches when no cursor exists. */
  INITIAL_BACKFILL_DAYS: 30,
  /** Overlap subtracted from the incremental window to avoid edge gaps. */
  INCREMENTAL_OVERLAP_MINUTES: 10,
  /** Default per-connection sync cadence (backend scheduler + mobile stale check). */
  DEFAULT_SYNC_FREQUENCY_MINUTES: 15,
} as const;

/** transaction_type written to inventory_transactions for imported POS sales. */
export const POS_INVENTORY_TX_TYPE = 'sale_pos';
