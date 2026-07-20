/**
 * Phase 16b — discovery latency telemetry + partition-prune SQL helpers.
 * Target: sub-100ms search path with shard routing.
 * Telemetry: DISCOVERY_LATENCY_VERIFIED
 */

export const DISCOVERY_LATENCY_BUDGET_MS = 100 as const;

export type DiscoveryLatencySample = {
  queryLatencyMs: number;
  indexLatencyMs: number;
  source: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK';
  routingApplied: boolean;
  partitionPruneApplied: boolean;
};

export type DiscoveryLatencyResult<T> = {
  result: T;
  sample: DiscoveryLatencySample;
};

export function nowMs(): number {
  return performance.now();
}

/**
 * Wrap a discovery query and record execution time vs optional index probe latency.
 */
export async function measureDiscoveryLatency<T>(input: {
  source: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK';
  routingApplied: boolean;
  partitionPruneApplied: boolean;
  indexProbeMs?: number;
  run: () => Promise<T>;
}): Promise<DiscoveryLatencyResult<T>> {
  const started = nowMs();
  const result = await input.run();
  const queryLatencyMs = Math.max(0, nowMs() - started);
  const sample: DiscoveryLatencySample = {
    queryLatencyMs,
    indexLatencyMs: Math.max(0, input.indexProbeMs ?? 0),
    source: input.source,
    routingApplied: input.routingApplied,
    partitionPruneApplied: input.partitionPruneApplied,
  };
  return { result, sample };
}

export function isWithinLatencyBudget(
  sample: DiscoveryLatencySample,
  budgetMs: number = DISCOVERY_LATENCY_BUDGET_MS,
): boolean {
  return sample.queryLatencyMs <= budgetMs;
}

export function formatDiscoveryLatencyVerifiedLog(
  sample: DiscoveryLatencySample,
  budgetMs: number = DISCOVERY_LATENCY_BUDGET_MS,
): string {
  const within = isWithinLatencyBudget(sample, budgetMs) ? '1' : '0';
  return `DISCOVERY_LATENCY_VERIFIED QUERY_MS=${sample.queryLatencyMs.toFixed(2)} INDEX_MS=${sample.indexLatencyMs.toFixed(2)} BUDGET_MS=${budgetMs} WITHIN=${within} SOURCE=${sample.source} ROUTING=${sample.routingApplied ? '1' : '0'} PRUNE=${sample.partitionPruneApplied ? '1' : '0'}`;
}

/**
 * Prefer routing values that minimize shards scanned.
 * Connected vendors first; fall back to session vendor.
 */
export function resolveSearchRouting(input: {
  sessionVendorId?: string | null;
  connectedVendorIds?: string[];
  preferVendorIds?: string[];
}): string[] {
  const preferred = (input.preferVendorIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (preferred.length > 0) {
    return [...new Set(preferred)];
  }
  const connected = (input.connectedVendorIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (connected.length > 0) {
    return [...new Set(connected)];
  }
  const session = (input.sessionVendorId ?? '').trim();
  return session ? [session] : [];
}

/**
 * SQL prune window for discovery joins against partitioned orders.
 * Uses recent months so Postgres can eliminate cold partitions.
 */
export function buildDiscoveryOrderPruneWindow(
  reference: Date = new Date(),
  monthsBack = 3,
): { start: Date; end: Date } {
  const end = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const start = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() - (Math.max(1, monthsBack) - 1),
      1,
      0,
      0,
      0,
      0,
    ),
  );
  return { start, end };
}

export function buildDiscoveryOrderActivityPruneSql(input: {
  start: Date;
  end: Date;
  productAlias?: string;
}): string {
  const productAlias = input.productAlias ?? 'wp';
  return [
    'LEFT JOIN (',
    '  SELECT oi.product_id, COUNT(*)::int AS recent_order_lines',
    '  FROM public.order_items oi',
    `  WHERE oi.created_at >= TIMESTAMPTZ '${input.start.toISOString()}'`,
    `    AND oi.created_at <  TIMESTAMPTZ '${input.end.toISOString()}'`,
    '  GROUP BY oi.product_id',
    `) recent_oi ON recent_oi.product_id = ${productAlias}.id`,
  ].join('\n');
}

export function assertDiscoveryPruneSqlValid(sql: string): void {
  if (!sql.includes('oi.created_at >=')) {
    throw new Error('DISCOVERY_PRUNE_SQL_INVALID MISSING_LOWER_BOUND');
  }
  if (!sql.includes('oi.created_at <')) {
    throw new Error('DISCOVERY_PRUNE_SQL_INVALID MISSING_UPPER_BOUND');
  }
}
