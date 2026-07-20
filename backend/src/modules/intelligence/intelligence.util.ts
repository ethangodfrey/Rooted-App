/**
 * Automated intelligence helpers — weekly growth + anomaly thresholds.
 * Telemetry: REPORTING_ENGINE_INITIALIZED, ANOMALY_DETECTION_ACTIVE,
 *            PERFORMANCE_ANOMALY_DETECTED
 */

export type IntelligenceMetricType = 'VIEW' | 'INQUIRY' | 'RSVP';

export type MetricTotals = {
  views: number;
  inquiries: number;
  rsvps: number;
};

export type GrowthSummary = {
  views: number;
  inquiries: number;
  rsvps: number;
  viewsGrowthPct: number | null;
  inquiriesGrowthPct: number | null;
  rsvpsGrowthPct: number | null;
};

export type AnomalyDirection = 'DROP' | 'SPIKE';

export type AnomalyFinding = {
  metricType: IntelligenceMetricType;
  currentRate: number;
  baselineRate: number;
  changePct: number;
  direction: AnomalyDirection;
};

/** Drop greater than 40% vs baseline. */
export const ANOMALY_DROP_THRESHOLD_PCT = 40;
/** Spike greater than 100% vs baseline. */
export const ANOMALY_SPIKE_THRESHOLD_PCT = 100;

export function formatReportingEngineInitializedLog(): string {
  return 'REPORTING_ENGINE_INITIALIZED SURFACE=WEEKLY_PERFORMANCE';
}

export function formatAnomalyDetectionActiveLog(): string {
  return 'ANOMALY_DETECTION_ACTIVE WINDOW_DAYS=30';
}

export function formatPerformanceAnomalyDetectedLog(input: {
  entityId: string;
  metricType: IntelligenceMetricType;
  direction: AnomalyDirection;
  changePct: number;
}): string {
  return `PERFORMANCE_ANOMALY_DETECTED ENTITY=${input.entityId} METRIC=${input.metricType} DIRECTION=${input.direction} CHANGE_PCT=${input.changePct.toFixed(1)}`;
}

export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function buildGrowthSummary(
  current: MetricTotals,
  previous: MetricTotals,
): GrowthSummary {
  return {
    views: current.views,
    inquiries: current.inquiries,
    rsvps: current.rsvps,
    viewsGrowthPct: percentChange(current.views, previous.views),
    inquiriesGrowthPct: percentChange(current.inquiries, previous.inquiries),
    rsvpsGrowthPct: percentChange(current.rsvps, previous.rsvps),
  };
}

export function formatGrowthLabel(pct: number | null): string {
  if (pct == null) return 'N/A';
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

export function formatWeeklySummaryText(input: {
  entityLabel: string;
  periodStart: string;
  periodEnd: string;
  growth: GrowthSummary;
}): string {
  const g = input.growth;
  return [
    `WEEKLY PERFORMANCE — ${input.entityLabel}`,
    `PERIOD ${input.periodStart} TO ${input.periodEnd}`,
    `VIEWS ${g.views} (${formatGrowthLabel(g.viewsGrowthPct)} WOVW)`,
    `INQUIRIES ${g.inquiries} (${formatGrowthLabel(g.inquiriesGrowthPct)} WOVW)`,
    `RSVPS ${g.rsvps} (${formatGrowthLabel(g.rsvpsGrowthPct)} WOVW)`,
  ].join('\n');
}

/**
 * Compare a current daily rate against a 30-day rolling average.
 * DROP when changePct <= -40; SPIKE when changePct >= +100.
 */
export function detectAnomaly(input: {
  metricType: IntelligenceMetricType;
  currentRate: number;
  baselineRate: number;
  dropThresholdPct?: number;
  spikeThresholdPct?: number;
}): AnomalyFinding | null {
  const drop =
    input.dropThresholdPct ?? ANOMALY_DROP_THRESHOLD_PCT;
  const spike =
    input.spikeThresholdPct ?? ANOMALY_SPIKE_THRESHOLD_PCT;

  const current = Math.max(0, input.currentRate);
  const baseline = Math.max(0, input.baselineRate);

  if (baseline === 0) {
    if (current === 0) return null;
    // New activity from a zero baseline counts as a spike when current is material.
    if (current >= 1) {
      return {
        metricType: input.metricType,
        currentRate: current,
        baselineRate: baseline,
        changePct: 100,
        direction: 'SPIKE',
      };
    }
    return null;
  }

  const changePct = ((current - baseline) / baseline) * 100;
  if (changePct <= -drop) {
    return {
      metricType: input.metricType,
      currentRate: current,
      baselineRate: baseline,
      changePct,
      direction: 'DROP',
    };
  }
  if (changePct >= spike) {
    return {
      metricType: input.metricType,
      currentRate: current,
      baselineRate: baseline,
      changePct,
      direction: 'SPIKE',
    };
  }
  return null;
}

export function averageDailyRate(total: number, days: number): number {
  const safeDays = Math.max(1, days);
  return Math.max(0, total) / safeDays;
}

export function formatAnomalySummaryText(input: {
  entityLabel: string;
  finding: AnomalyFinding;
}): string {
  const f = input.finding;
  const verb = f.direction === 'DROP' ? 'DROPPED' : 'SPIKED';
  return [
    `PERFORMANCE ANOMALY — ${input.entityLabel}`,
    `${f.metricType} RATE ${verb} ${formatGrowthLabel(f.changePct)} VS 30-DAY AVERAGE`,
    `CURRENT_DAILY ${f.currentRate.toFixed(2)} BASELINE_DAILY ${f.baselineRate.toFixed(2)}`,
  ].join('\n');
}

/** Previous complete Mon–Sun week ending before the Monday of `asOf`'s week. */
export function resolvePreviousWeekRange(asOf: Date = new Date()): {
  periodStart: string;
  periodEnd: string;
  priorStart: string;
  priorEnd: string;
} {
  const d = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0=Sun … 1=Mon
  const daysFromMonday = (day + 6) % 7;
  const thisWeekMonday = new Date(d);
  thisWeekMonday.setUTCDate(d.getUTCDate() - daysFromMonday);

  const periodEnd = new Date(thisWeekMonday);
  periodEnd.setUTCDate(thisWeekMonday.getUTCDate() - 1);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodEnd.getUTCDate() - 6);

  const priorEnd = new Date(periodStart);
  priorEnd.setUTCDate(periodStart.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorEnd.getUTCDate() - 6);

  const key = (x: Date) => x.toISOString().slice(0, 10);
  return {
    periodStart: key(periodStart),
    periodEnd: key(periodEnd),
    priorStart: key(priorStart),
    priorEnd: key(priorEnd),
  };
}
