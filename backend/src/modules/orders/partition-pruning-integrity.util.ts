/**
 * Health suite — partition pruning integrity for orders / order_items.
 * Parses EXPLAIN / EXPLAIN ANALYZE plans and fails when a single-month
 * query touches more than MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY partitions.
 */

import { monthlyPartitionBounds } from './orders-partitioning.strategy';

export const MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY = 2 as const;

const PARTITION_SCAN_RE =
  /\b(?:Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan|Bitmap Index Scan)\s+on\s+(orders|order_items)_(y\d{4}m\d{2})\b/gi;

export type PartitionPruneExplainPlan = {
  sql: string;
  explainSql: string;
  monthSuffix: string;
  start: Date;
  end: Date;
};

export function buildSingleMonthOrdersExplainPlan(
  reference: Date = new Date(),
): PartitionPruneExplainPlan {
  const bounds = monthlyPartitionBounds(reference);
  const sql = [
    'SELECT *',
    'FROM public.orders',
    `WHERE created_at >= TIMESTAMPTZ '${bounds.start.toISOString()}'`,
    `  AND created_at <  TIMESTAMPTZ '${bounds.end.toISOString()}'`,
  ].join('\n');

  return {
    sql,
    explainSql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    monthSuffix: bounds.suffix,
    start: bounds.start,
    end: bounds.end,
  };
}

/**
 * Collect distinct monthly partition suffixes touched by leaf scans.
 * Parent Append / MergeAppend nodes are ignored; only concrete partitions count.
 */
export function collectTouchedPartitionSuffixes(explainText: string): string[] {
  const found = new Set<string>();
  for (const match of explainText.matchAll(PARTITION_SCAN_RE)) {
    found.add(match[2].toLowerCase());
  }
  return [...found].sort();
}

export function countTouchedPartitions(explainText: string): number {
  return collectTouchedPartitionSuffixes(explainText).length;
}

export function assertPartitionPruningForSingleMonth(input: {
  explainText: string;
  expectedSuffix: string;
  maxPartitions?: number;
}): {
  touched: string[];
  pruningConfirmed: boolean;
} {
  const max = input.maxPartitions ?? MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY;
  const touched = collectTouchedPartitionSuffixes(input.explainText);

  if (touched.length === 0) {
    const mentionsExpected = input.explainText
      .toLowerCase()
      .includes(input.expectedSuffix.toLowerCase());
    const partitionsRemoved = /\bPartitions?\s+removed\b/i.test(
      input.explainText,
    );
    if (!mentionsExpected && !partitionsRemoved) {
      throw new Error(
        `PARTITION_INTEGRITY_FAIL NO_PARTITION_SCANS EXPECTED=${input.expectedSuffix}`,
      );
    }
  }

  if (touched.length > max) {
    throw new Error(
      `PARTITION_INTEGRITY_FAIL TOUCHED=${touched.length} MAX=${max} PARTITIONS=${touched.join(',')}`,
    );
  }

  if (
    touched.length > 0 &&
    !touched.includes(input.expectedSuffix.toLowerCase())
  ) {
    throw new Error(
      `PARTITION_INTEGRITY_FAIL EXPECTED=${input.expectedSuffix} TOUCHED=${touched.join(',')}`,
    );
  }

  return { touched, pruningConfirmed: true };
}

/**
 * Representative EXPLAIN ANALYZE output for a correctly pruned single-month query.
 * Used by the offline regression harness when DATABASE_URL is unset.
 */
export function samplePrunedExplainAnalyze(suffix: string): string {
  return [
    'Seq Scan on orders_' + suffix + ' orders  (cost=0.00..12.50 rows=100 width=128) (actual time=0.020..0.080 rows=40 loops=1)',
    '  Filter: ((created_at >= \'2026-07-01 00:00:00+00\'::timestamp with time zone) AND (created_at < \'2026-08-01 00:00:00+00\'::timestamp with time zone))',
    '  Buffers: shared hit=4',
    'Planning Time: 0.200 ms',
    'Execution Time: 0.120 ms',
  ].join('\n');
}

/**
 * Anti-pattern plan that scans three monthly partitions for a single-month filter.
 */
export function sampleUnprunedExplainAnalyze(): string {
  return [
    'Append  (cost=0.00..40.00 rows=300 width=128) (actual time=0.050..1.200 rows=120 loops=1)',
    '  ->  Seq Scan on orders_y2026m05 orders_1  (cost=0.00..12.00 rows=100 width=128) (actual time=0.010..0.300 rows=40 loops=1)',
    '  ->  Seq Scan on orders_y2026m06 orders_2  (cost=0.00..12.00 rows=100 width=128) (actual time=0.010..0.300 rows=40 loops=1)',
    '  ->  Seq Scan on orders_y2026m07 orders_3  (cost=0.00..12.00 rows=100 width=128) (actual time=0.010..0.300 rows=40 loops=1)',
    'Planning Time: 0.400 ms',
    'Execution Time: 1.400 ms',
  ].join('\n');
}
