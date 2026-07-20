import {
  CDN_SERVE_P95_BUDGET_MS,
  CO_APPROVAL_LATENCY_BUDGET_MS,
  MAX_OPTIMIZED_IMAGE_BYTES,
  MAX_OPTIMIZED_IMAGE_WIDTH_PX,
  NOTIFY_TO_UI_LATENCY_BUDGET_MS,
  computeP95,
  evaluateAssetOptimization,
  formatDualPostingMetricCapturedLog,
  formatLatencyThresholdValidatedLog,
  isWithinBudget,
  notifyToUiLatencyMs,
} from './content-dual-posting-metrics.util';

describe('Dual-posting performance observability', () => {
  it('captures co-approval latency metrics within budget', () => {
    const valueMs = 250;
    const log = formatDualPostingMetricCapturedLog({
      kind: 'CO_APPROVAL_LATENCY',
      postId: 'post-1',
      valueMs,
      withinBudget: isWithinBudget(valueMs, CO_APPROVAL_LATENCY_BUDGET_MS),
    });
    expect(log).toContain('DUAL_POSTING_METRIC_CAPTURED');
    expect(log).toContain('KIND=CO_APPROVAL_LATENCY');
    expect(
      formatLatencyThresholdValidatedLog({
        kind: 'CO_APPROVAL_LATENCY',
        valueMs,
        budgetMs: CO_APPROVAL_LATENCY_BUDGET_MS,
        postId: 'post-1',
      }),
    ).toContain('LATENCY_THRESHOLD_VALIDATED');
  });

  it('measures notify-to-UI latency from CONTENT_CONTRIBUTION trigger', () => {
    const notifiedAt = new Date(Date.now() - 1_200);
    const latency = notifyToUiLatencyMs(notifiedAt);
    expect(latency).toBeGreaterThanOrEqual(1_000);
    expect(
      isWithinBudget(latency, NOTIFY_TO_UI_LATENCY_BUDGET_MS),
    ).toBe(true);
  });

  it('fails CDN P95 when above 100ms target', () => {
    const samples = [40, 50, 60, 70, 80, 90, 95, 110, 120, 150];
    const p95 = computeP95(samples);
    expect(p95).toBeGreaterThan(CDN_SERVE_P95_BUDGET_MS);
    expect(isWithinBudget(p95, CDN_SERVE_P95_BUDGET_MS)).toBe(false);
  });

  it('fails asset threshold when resolution/size exceed optimization limits', () => {
    const result = evaluateAssetOptimization({
      kind: 'photo',
      widthPx: MAX_OPTIMIZED_IMAGE_WIDTH_PX + 1,
      sizeBytes: MAX_OPTIMIZED_IMAGE_BYTES + 1,
    });
    expect(result.withinThreshold).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
