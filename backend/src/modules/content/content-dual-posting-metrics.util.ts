/**
 * Dual-posting performance observability helpers.
 * Telemetry: DUAL_POSTING_METRIC_CAPTURED, LATENCY_THRESHOLD_VALIDATED
 */

export const CO_APPROVAL_LATENCY_BUDGET_MS = 2_000 as const;
export const NOTIFY_TO_UI_LATENCY_BUDGET_MS = 5_000 as const;
export const CDN_SERVE_P95_BUDGET_MS = 100 as const;

export const MAX_OPTIMIZED_IMAGE_WIDTH_PX = 1600 as const;
export const MAX_OPTIMIZED_IMAGE_HEIGHT_PX = 1600 as const;
export const MAX_OPTIMIZED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_OPTIMIZED_VIDEO_BYTES = 50 * 1024 * 1024;

export type DualPostingMetricKind =
  | 'CO_APPROVAL_LATENCY'
  | 'NOTIFY_TO_UI_LATENCY'
  | 'CDN_SERVE'
  | 'ASSET_THRESHOLD'
  | 'SYNC_HEALTH';

export type DualPostingMetricSample = {
  kind: DualPostingMetricKind;
  postId?: string | null;
  valueMs?: number | null;
  p95Ms?: number | null;
  withinBudget: boolean;
  detail?: string;
};

export type AssetOptimizationInput = {
  kind: 'image' | 'video' | 'photo' | 'TEXT' | 'PHOTO' | 'VIDEO' | string;
  widthPx?: number | null;
  heightPx?: number | null;
  sizeBytes?: number | null;
};

export type AssetOptimizationResult = {
  withinThreshold: boolean;
  failures: string[];
  kind: string;
};

export function nowMs(): number {
  return performance.now();
}

export function elapsedMs(started: number): number {
  return Math.max(0, nowMs() - started);
}

export function computeP95(samplesMs: number[]): number {
  if (samplesMs.length === 0) return 0;
  const sorted = [...samplesMs].map((n) => Math.max(0, n)).sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  const idx = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[idx] ?? 0;
}

export function isWithinBudget(valueMs: number, budgetMs: number): boolean {
  return valueMs <= budgetMs;
}

export function evaluateAssetOptimization(
  input: AssetOptimizationInput,
): AssetOptimizationResult {
  const kind = String(input.kind ?? '').toUpperCase();
  const failures: string[] = [];
  const imageLike = kind === 'IMAGE' || kind === 'PHOTO';
  const videoLike = kind === 'VIDEO';

  if (imageLike) {
    if (
      input.widthPx != null &&
      input.widthPx > MAX_OPTIMIZED_IMAGE_WIDTH_PX
    ) {
      failures.push(
        `WIDTH_PX=${input.widthPx}>${MAX_OPTIMIZED_IMAGE_WIDTH_PX}`,
      );
    }
    if (
      input.heightPx != null &&
      input.heightPx > MAX_OPTIMIZED_IMAGE_HEIGHT_PX
    ) {
      failures.push(
        `HEIGHT_PX=${input.heightPx}>${MAX_OPTIMIZED_IMAGE_HEIGHT_PX}`,
      );
    }
    if (
      input.sizeBytes != null &&
      input.sizeBytes > MAX_OPTIMIZED_IMAGE_BYTES
    ) {
      failures.push(
        `SIZE_BYTES=${input.sizeBytes}>${MAX_OPTIMIZED_IMAGE_BYTES}`,
      );
    }
  } else if (videoLike) {
    if (
      input.sizeBytes != null &&
      input.sizeBytes > MAX_OPTIMIZED_VIDEO_BYTES
    ) {
      failures.push(
        `SIZE_BYTES=${input.sizeBytes}>${MAX_OPTIMIZED_VIDEO_BYTES}`,
      );
    }
  }

  return {
    withinThreshold: failures.length === 0,
    failures,
    kind: kind || 'UNKNOWN',
  };
}

export function formatDualPostingMetricCapturedLog(
  sample: DualPostingMetricSample,
): string {
  const parts = [
    'DUAL_POSTING_METRIC_CAPTURED',
    `KIND=${sample.kind}`,
    sample.postId ? `POST=${sample.postId}` : null,
    sample.valueMs != null ? `VALUE_MS=${sample.valueMs.toFixed(2)}` : null,
    sample.p95Ms != null ? `P95_MS=${sample.p95Ms.toFixed(2)}` : null,
    `WITHIN_BUDGET=${sample.withinBudget ? '1' : '0'}`,
    sample.detail ? `DETAIL=${sample.detail}` : null,
  ].filter(Boolean);
  return parts.join(' ');
}

export function formatLatencyThresholdValidatedLog(input: {
  kind: DualPostingMetricKind;
  valueMs: number;
  budgetMs: number;
  postId?: string | null;
}): string {
  const within = isWithinBudget(input.valueMs, input.budgetMs);
  return [
    'LATENCY_THRESHOLD_VALIDATED',
    `KIND=${input.kind}`,
    input.postId ? `POST=${input.postId}` : null,
    `VALUE_MS=${input.valueMs.toFixed(2)}`,
    `BUDGET_MS=${input.budgetMs}`,
    `WITHIN=${within ? '1' : '0'}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatCdnServeFailLog(input: {
  postId?: string | null;
  p95Ms: number;
  budgetMs?: number;
}): string {
  const budget = input.budgetMs ?? CDN_SERVE_P95_BUDGET_MS;
  return [
    'DUAL_POSTING_METRIC_CAPTURED',
    'KIND=CDN_SERVE',
    input.postId ? `POST=${input.postId}` : null,
    `P95_MS=${input.p95Ms.toFixed(2)}`,
    `BUDGET_MS=${budget}`,
    'WITHIN_BUDGET=0',
    'DETAIL=CDN_P95_EXCEEDED',
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatAssetThresholdFailLog(input: {
  postId?: string | null;
  failures: string[];
}): string {
  return [
    'DUAL_POSTING_METRIC_CAPTURED',
    'KIND=ASSET_THRESHOLD',
    input.postId ? `POST=${input.postId}` : null,
    'WITHIN_BUDGET=0',
    `DETAIL=ASSET_THRESHOLD_EXCEEDED:${input.failures.join(',')}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function notifyToUiLatencyMs(
  notifiedAt: Date | string,
  receivedAt: Date = new Date(),
): number {
  const start =
    typeof notifiedAt === 'string'
      ? new Date(notifiedAt).getTime()
      : notifiedAt.getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, receivedAt.getTime() - start);
}
