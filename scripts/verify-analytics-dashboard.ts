/**
 * Engagement analytics dashboard verification.
 *
 * Usage:
 *   npm run test:analytics:dashboard
 *
 * Success lines (uppercase, no emoji):
 *   ANALYTICS_DASHBOARD_INITIALIZED
 *   METRICS_SYNC_COMPLETE
 *   ANALYTICS_DASHBOARD_VERIFIED
 */

import {
  buildDateRange,
  buildEngagementTotals,
  formatAnalyticsDashboardInitializedLog,
  formatMetricsSyncCompleteLog,
  mergeMetricRows,
  normalizeEntityType,
  normalizeMetricType,
  seriesForMetric,
  type EngagementMetricRow,
} from '../backend/src/modules/analytics/analytics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatAnalyticsDashboardInitializedLog());

  assert(normalizeEntityType('farmer') === 'FARMER', 'ENTITY_FARMER_FAIL');
  assert(normalizeEntityType('vendor') === 'VENDOR', 'ENTITY_VENDOR_FAIL');
  assert(normalizeMetricType('CLICK') === 'VIEW', 'CLICK_TO_VIEW_FAIL');
  assert(normalizeMetricType('INQUIRY') === 'INQUIRY', 'INQUIRY_TYPE_FAIL');
  assert(normalizeMetricType('RSVP') === 'RSVP', 'RSVP_TYPE_FAIL');
  assert(normalizeMetricType('NOPE') === null, 'INVALID_TYPE_FAIL');

  const range = buildDateRange(7);
  assert(range.length === 7, 'DATE_RANGE_FAIL');

  const stored: EngagementMetricRow[] = [
    { metricDate: range[0], metricType: 'VIEW', count: 4 },
    { metricDate: range[2], metricType: 'VIEW', count: 6 },
    { metricDate: range[2], metricType: 'INQUIRY', count: 2 },
    { metricDate: range[5], metricType: 'RSVP', count: 1 },
  ];
  const backfill: EngagementMetricRow[] = [
    { metricDate: range[2], metricType: 'INQUIRY', count: 1 },
  ];
  const merged = mergeMetricRows(stored, backfill);
  const inquiryOnDay2 = merged.find(
    (row) => row.metricDate === range[2] && row.metricType === 'INQUIRY',
  );
  assert(inquiryOnDay2?.count === 3, 'MERGE_INQUIRY_FAIL');

  const totals = buildEngagementTotals(merged, 5);
  assert(totals.views === 10, `VIEWS_FAIL GOT=${totals.views}`);
  assert(totals.inquiries === 3, `INQUIRIES_FAIL GOT=${totals.inquiries}`);
  assert(totals.rsvps === 1, `RSVPS_FAIL GOT=${totals.rsvps}`);
  assert(totals.collaborations === 5, 'COLLAB_FAIL');
  assert(totals.postReach === 10, 'REACH_FAIL');

  const reachSeries = seriesForMetric(merged, 'VIEW', 7);
  assert(reachSeries.length === 7, 'SERIES_LEN_FAIL');
  assert(
    reachSeries.reduce((acc, point) => acc + point.count, 0) === 10,
    'SERIES_SUM_FAIL',
  );

  log(
    formatMetricsSyncCompleteLog({
      entityId: '11111111-1111-4111-8111-111111111111',
      days: 7,
      total: totals.views + totals.inquiries + totals.rsvps,
    }),
  );

  log('ANALYTICS_DASHBOARD_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ANALYTICS_DASHBOARD_FAILED ${message}`);
  process.exitCode = 1;
}
