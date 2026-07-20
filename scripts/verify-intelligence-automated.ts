/**
 * Automated intelligence verification (weekly reports + anomaly detection).
 *
 * Usage:
 *   npm run test:intelligence:automated
 *
 * Success lines (uppercase, no emoji):
 *   REPORTING_ENGINE_INITIALIZED
 *   ANOMALY_DETECTION_ACTIVE
 *   PERFORMANCE_ANOMALY_DETECTED
 *   INTELLIGENCE_AUTOMATED_VERIFIED
 */

import {
  ANOMALY_DROP_THRESHOLD_PCT,
  ANOMALY_SPIKE_THRESHOLD_PCT,
  averageDailyRate,
  buildGrowthSummary,
  detectAnomaly,
  formatAnomalyDetectionActiveLog,
  formatAnomalySummaryText,
  formatGrowthLabel,
  formatPerformanceAnomalyDetectedLog,
  formatReportingEngineInitializedLog,
  formatWeeklySummaryText,
  percentChange,
  resolvePreviousWeekRange,
} from '../backend/src/modules/intelligence/intelligence.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatReportingEngineInitializedLog());
  log(formatAnomalyDetectionActiveLog());

  assert(ANOMALY_DROP_THRESHOLD_PCT === 40, 'DROP_THRESHOLD_FAIL');
  assert(ANOMALY_SPIKE_THRESHOLD_PCT === 100, 'SPIKE_THRESHOLD_FAIL');

  const monday = new Date(Date.UTC(2026, 6, 20)); // Mon Jul 20 2026
  const range = resolvePreviousWeekRange(monday);
  assert(range.periodStart === '2026-07-13', `WEEK_START_FAIL GOT=${range.periodStart}`);
  assert(range.periodEnd === '2026-07-19', `WEEK_END_FAIL GOT=${range.periodEnd}`);
  assert(range.priorStart === '2026-07-06', `PRIOR_START_FAIL GOT=${range.priorStart}`);
  assert(range.priorEnd === '2026-07-12', `PRIOR_END_FAIL GOT=${range.priorEnd}`);

  const growth = buildGrowthSummary(
    { views: 150, inquiries: 12, rsvps: 8 },
    { views: 100, inquiries: 10, rsvps: 10 },
  );
  assert(growth.viewsGrowthPct === 50, 'VIEWS_GROWTH_FAIL');
  assert(growth.inquiriesGrowthPct === 20, 'INQUIRY_GROWTH_FAIL');
  assert(growth.rsvpsGrowthPct === -20, 'RSVP_GROWTH_FAIL');
  assert(formatGrowthLabel(50) === '+50%', 'GROWTH_LABEL_FAIL');
  assert(percentChange(0, 0) === 0, 'ZERO_CHANGE_FAIL');

  const summary = formatWeeklySummaryText({
    entityLabel: 'River Farm',
    periodStart: range.periodStart,
    periodEnd: range.periodEnd,
    growth,
  });
  assert(summary.includes('VIEWS 150'), 'SUMMARY_VIEWS_FAIL');
  assert(summary.includes('INQUIRIES 12'), 'SUMMARY_INQUIRIES_FAIL');

  const drop = detectAnomaly({
    metricType: 'INQUIRY',
    currentRate: averageDailyRate(3, 1),
    baselineRate: averageDailyRate(100, 30),
  });
  assert(drop?.direction === 'DROP', 'DROP_DETECT_FAIL');
  assert((drop?.changePct ?? 0) <= -40, 'DROP_PCT_FAIL');

  const spike = detectAnomaly({
    metricType: 'VIEW',
    currentRate: 20,
    baselineRate: 5,
  });
  assert(spike?.direction === 'SPIKE', 'SPIKE_DETECT_FAIL');
  assert((spike?.changePct ?? 0) >= 100, 'SPIKE_PCT_FAIL');

  const steady = detectAnomaly({
    metricType: 'RSVP',
    currentRate: 5,
    baselineRate: 5,
  });
  assert(steady == null, 'STEADY_SHOULD_BE_NULL');

  log(
    formatPerformanceAnomalyDetectedLog({
      entityId: '22222222-2222-4222-8222-222222222222',
      metricType: 'INQUIRY',
      direction: drop!.direction,
      changePct: drop!.changePct,
    }),
  );
  log(
    formatAnomalySummaryText({
      entityLabel: 'River Farm',
      finding: drop!,
    }).split('\n')[0],
  );

  log('INTELLIGENCE_AUTOMATED_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`INTELLIGENCE_AUTOMATED_FAILED ${message}`);
  process.exitCode = 1;
}
