import {
  computePlatformFeeCents,
  type SettlementOrderInput,
} from '@/lib/settlement-calculator';

export type SettlementPeriodGranularity = 'day' | 'week';

export interface SettlementPeriodPoint {
  key: string;
  label: string;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  orderCount: number;
}

export interface SettlementSizeBucket {
  label: string;
  minCents: number;
  maxCents: number | null;
  grossCents: number;
  platformFeeCents: number;
  orderCount: number;
}

export interface SettlementChartData {
  granularity: SettlementPeriodGranularity;
  periods: SettlementPeriodPoint[];
  sizeBuckets: SettlementSizeBucket[];
  maxPeriodGrossCents: number;
}

const SIZE_BUCKETS: Array<{ label: string; minCents: number; maxCents: number | null }> = [
  { label: 'Under $10', minCents: 0, maxCents: 999 },
  { label: '$10–$25', minCents: 1000, maxCents: 2499 },
  { label: '$25–$50', minCents: 2500, maxCents: 4999 },
  { label: '$50–$100', minCents: 5000, maxCents: 9999 },
  { label: '$100+', minCents: 10000, maxCents: null },
];

function resolvePlatformFeeCents(order: SettlementOrderInput, grossCents: number): number {
  return order.platformFeeCents != null && Number.isFinite(order.platformFeeCents)
    ? Math.max(0, Math.round(order.platformFeeCents))
    : computePlatformFeeCents(grossCents);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(date);
  const weekday = normalized.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  normalized.setDate(normalized.getDate() + diff);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function toWeekKey(date: Date): string {
  return toDateKey(startOfWeek(date));
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatWeekLabel(weekStartKey: string): string {
  return `Wk ${formatDayLabel(weekStartKey)}`;
}

function resolveGranularity(orders: SettlementOrderInput[]): SettlementPeriodGranularity {
  const timestamps = orders
    .map((order) => order.completedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length < 2) return 'day';

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const spanDays = Math.ceil((max - min) / (1000 * 60 * 60 * 24));
  return spanDays > 42 ? 'week' : 'day';
}

function periodKeyForOrder(
  order: SettlementOrderInput,
  granularity: SettlementPeriodGranularity,
): string {
  const fallback = toDateKey(new Date());
  const completedAt = order.completedAt ?? fallback;
  const date = new Date(completedAt);
  if (!Number.isFinite(date.getTime())) return fallback;
  return granularity === 'week' ? toWeekKey(date) : toDateKey(date);
}

function focusPeriods(periods: SettlementPeriodPoint[]): SettlementPeriodPoint[] {
  const firstActive = periods.findIndex((period) => period.orderCount > 0);
  if (firstActive < 0) return periods.slice(-7);

  const lastActive = periods.reduce(
    (lastIndex, period, index) => (period.orderCount > 0 ? index : lastIndex),
    firstActive,
  );

  const start = Math.max(0, firstActive - 1);
  const end = Math.min(periods.length - 1, lastActive + 1);
  return periods.slice(start, end + 1);
}

export function buildSettlementChartData(
  orders: SettlementOrderInput[],
): SettlementChartData {
  const granularity = resolveGranularity(orders);
  const periodMap = new Map<string, SettlementPeriodPoint>();

  for (const order of orders) {
    const grossCents = Math.max(0, Math.round(order.totalCents));
    const platformFeeCents = resolvePlatformFeeCents(order, grossCents);
    const netCents = Math.max(0, grossCents - platformFeeCents);
    const key = periodKeyForOrder(order, granularity);

    const existing = periodMap.get(key) ?? {
      key,
      label: granularity === 'week' ? formatWeekLabel(key) : formatDayLabel(key),
      grossCents: 0,
      platformFeeCents: 0,
      netCents: 0,
      orderCount: 0,
    };

    existing.grossCents += grossCents;
    existing.platformFeeCents += platformFeeCents;
    existing.netCents += netCents;
    existing.orderCount += 1;
    periodMap.set(key, existing);
  }

  const periods = focusPeriods(
    [...periodMap.values()].sort((left, right) => left.key.localeCompare(right.key)),
  );

  const sizeBuckets: SettlementSizeBucket[] = SIZE_BUCKETS.map((bucket) => ({
    ...bucket,
    grossCents: 0,
    platformFeeCents: 0,
    orderCount: 0,
  }));

  for (const order of orders) {
    const grossCents = Math.max(0, Math.round(order.totalCents));
    const platformFeeCents = resolvePlatformFeeCents(order, grossCents);
    const bucket =
      sizeBuckets.find(
        (candidate) =>
          grossCents >= candidate.minCents &&
          (candidate.maxCents == null || grossCents <= candidate.maxCents),
      ) ?? sizeBuckets[sizeBuckets.length - 1]!;

    bucket.grossCents += grossCents;
    bucket.platformFeeCents += platformFeeCents;
    bucket.orderCount += 1;
  }

  const maxPeriodGrossCents = Math.max(...periods.map((period) => period.grossCents), 1);

  return {
    granularity,
    periods,
    sizeBuckets: sizeBuckets.filter((bucket) => bucket.orderCount > 0),
    maxPeriodGrossCents,
  };
}
