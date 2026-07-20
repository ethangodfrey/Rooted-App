/**
 * Engagement analytics helpers — pure functions for dashboard aggregation.
 * Telemetry: ANALYTICS_DASHBOARD_INITIALIZED, METRICS_SYNC_COMPLETE
 */

export type EngagementEntityType = 'FARMER' | 'VENDOR';
export type EngagementMetricType = 'VIEW' | 'INQUIRY' | 'RSVP';

export type EngagementMetricRow = {
  metricDate: string;
  metricType: EngagementMetricType;
  count: number;
};

export type EngagementSeriesPoint = {
  date: string;
  count: number;
};

export type EngagementSummaryTotals = {
  views: number;
  inquiries: number;
  rsvps: number;
  collaborations: number;
  postReach: number;
};

export function formatAnalyticsDashboardInitializedLog(): string {
  return 'ANALYTICS_DASHBOARD_INITIALIZED SURFACE=ENGAGEMENT';
}

export function formatMetricsSyncCompleteLog(input: {
  entityId: string;
  days: number;
  total: number;
}): string {
  return `METRICS_SYNC_COMPLETE ENTITY=${input.entityId} DAYS=${input.days} TOTAL=${input.total}`;
}

export function normalizeEntityType(
  value: string | null | undefined,
): EngagementEntityType {
  const upper = (value ?? '').trim().toUpperCase();
  return upper === 'FARMER' ? 'FARMER' : 'VENDOR';
}

export function normalizeMetricType(
  value: string | null | undefined,
): EngagementMetricType | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'VIEW' || upper === 'INQUIRY' || upper === 'RSVP') {
    return upper;
  }
  if (upper === 'CLICK') return 'VIEW';
  return null;
}

export function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function buildDateRange(days: number, end: Date = new Date()): string[] {
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const keys: string[] = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}

export function sumMetricType(
  rows: EngagementMetricRow[],
  metricType: EngagementMetricType,
): number {
  return rows
    .filter((row) => row.metricType === metricType)
    .reduce((acc, row) => acc + Math.max(0, row.count), 0);
}

export function seriesForMetric(
  rows: EngagementMetricRow[],
  metricType: EngagementMetricType,
  days: number,
): EngagementSeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.metricType !== metricType) continue;
    const key = toDateKey(row.metricDate);
    byDate.set(key, (byDate.get(key) ?? 0) + Math.max(0, row.count));
  }
  return buildDateRange(days).map((date) => ({
    date,
    count: byDate.get(date) ?? 0,
  }));
}

/** Post reach = VIEW counts (CLICK interactions normalize to VIEW). */
export function buildEngagementTotals(
  rows: EngagementMetricRow[],
  collaborations: number,
): EngagementSummaryTotals {
  const views = sumMetricType(rows, 'VIEW');
  const inquiries = sumMetricType(rows, 'INQUIRY');
  const rsvps = sumMetricType(rows, 'RSVP');
  return {
    views,
    inquiries,
    rsvps,
    collaborations: Math.max(0, collaborations),
    postReach: views,
  };
}

export function mergeMetricRows(
  ...groups: EngagementMetricRow[][]
): EngagementMetricRow[] {
  const map = new Map<string, EngagementMetricRow>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${toDateKey(row.metricDate)}|${row.metricType}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += Math.max(0, row.count);
      } else {
        map.set(key, {
          metricDate: toDateKey(row.metricDate),
          metricType: row.metricType,
          count: Math.max(0, row.count),
        });
      }
    }
  }
  return [...map.values()];
}
