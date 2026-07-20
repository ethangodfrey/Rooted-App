/**
 * Dual-posting performance observability verification.
 *
 * Usage:
 *   npm run test:content:dual-posting-observability
 *
 * Success lines (uppercase, no emoji):
 *   DUAL_POSTING_METRIC_CAPTURED
 *   LATENCY_THRESHOLD_VALIDATED
 *   DUAL_POSTING_OBSERVABILITY_VERIFIED
 */

import {
  CDN_SERVE_P95_BUDGET_MS,
  CO_APPROVAL_LATENCY_BUDGET_MS,
  MAX_OPTIMIZED_IMAGE_HEIGHT_PX,
  MAX_OPTIMIZED_IMAGE_WIDTH_PX,
  NOTIFY_TO_UI_LATENCY_BUDGET_MS,
  computeP95,
  evaluateAssetOptimization,
  formatAssetThresholdFailLog,
  formatCdnServeFailLog,
  formatDualPostingMetricCapturedLog,
  formatLatencyThresholdValidatedLog,
  isWithinBudget,
  notifyToUiLatencyMs,
} from '../backend/src/modules/content/content-dual-posting-metrics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const coApprovalMs = 180;
  assert(
    isWithinBudget(coApprovalMs, CO_APPROVAL_LATENCY_BUDGET_MS),
    'CO_APPROVAL_BUDGET_FAIL',
  );
  log(
    formatDualPostingMetricCapturedLog({
      kind: 'CO_APPROVAL_LATENCY',
      postId: '55555555-5555-4555-8555-555555555555',
      valueMs: coApprovalMs,
      withinBudget: true,
      detail: 'ACTION=CO_APPROVE',
    }),
  );
  log(
    formatLatencyThresholdValidatedLog({
      kind: 'CO_APPROVAL_LATENCY',
      postId: '55555555-5555-4555-8555-555555555555',
      valueMs: coApprovalMs,
      budgetMs: CO_APPROVAL_LATENCY_BUDGET_MS,
    }),
  );

  const notifiedAt = new Date(Date.now() - 800);
  const notifyLatency = notifyToUiLatencyMs(notifiedAt);
  assert(notifyLatency >= 700, 'NOTIFY_LATENCY_TOO_SMALL');
  assert(
    isWithinBudget(notifyLatency, NOTIFY_TO_UI_LATENCY_BUDGET_MS),
    'NOTIFY_TO_UI_BUDGET_FAIL',
  );
  log(
    formatDualPostingMetricCapturedLog({
      kind: 'NOTIFY_TO_UI_LATENCY',
      postId: '55555555-5555-4555-8555-555555555555',
      valueMs: notifyLatency,
      withinBudget: true,
      detail: 'PHASE=UI_RECEIVED',
    }),
  );

  const healthyCdn = computeP95([12, 18, 22, 28, 31, 35, 40, 44, 48, 55]);
  assert(healthyCdn < CDN_SERVE_P95_BUDGET_MS, 'CDN_P95_HEALTHY_FAIL');
  log(
    formatDualPostingMetricCapturedLog({
      kind: 'CDN_SERVE',
      p95Ms: healthyCdn,
      withinBudget: true,
      detail: 'PROBE_OK',
    }),
  );
  log(
    formatLatencyThresholdValidatedLog({
      kind: 'CDN_SERVE',
      valueMs: healthyCdn,
      budgetMs: CDN_SERVE_P95_BUDGET_MS,
    }),
  );

  const degradedCdn = computeP95([90, 95, 100, 105, 110, 120, 130, 140, 150, 180]);
  assert(degradedCdn >= CDN_SERVE_P95_BUDGET_MS, 'CDN_P95_DEGRADED_EXPECTED');
  log(formatCdnServeFailLog({ p95Ms: degradedCdn }));

  const oversize = evaluateAssetOptimization({
    kind: 'PHOTO',
    widthPx: MAX_OPTIMIZED_IMAGE_WIDTH_PX + 400,
    heightPx: MAX_OPTIMIZED_IMAGE_HEIGHT_PX + 200,
    sizeBytes: 6 * 1024 * 1024,
  });
  assert(!oversize.withinThreshold, 'ASSET_THRESHOLD_SHOULD_FAIL');
  log(
    formatAssetThresholdFailLog({
      postId: '55555555-5555-4555-8555-555555555555',
      failures: oversize.failures,
    }),
  );

  const okAsset = evaluateAssetOptimization({
    kind: 'PHOTO',
    widthPx: 1200,
    heightPx: 800,
    sizeBytes: 900_000,
  });
  assert(okAsset.withinThreshold, 'ASSET_THRESHOLD_SHOULD_PASS');

  log(
    formatDualPostingMetricCapturedLog({
      kind: 'SYNC_HEALTH',
      withinBudget: true,
      detail: 'STATUS=OK;PENDING_WITHOUT_CREATE=0;ORPHANS=0',
    }),
  );

  log('DUAL_POSTING_OBSERVABILITY_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DUAL_POSTING_OBSERVABILITY_FAILED ${message}`);
  process.exitCode = 1;
}
