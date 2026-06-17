import { DateTime } from 'luxon';

const VALID_DAYS = new Set([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

/** Local wall-clock hour for a UTC instant in the market timezone. */
export function localWallHour(iso: Date | string, timezone: string): number {
  const dt = DateTime.fromJSDate(iso instanceof Date ? iso : new Date(iso), { zone: 'utc' }).setZone(
    timezone,
  );
  return dt.isValid ? dt.hour : 0;
}

/** True when stored start time looks like a UTC/local mix-up (e.g. 8 UTC shown as 2am local). */
export function hasSuspiciousLocalStartHour(
  startIso: Date | string,
  timezone: string,
  expectedStartHour?: number,
): boolean {
  const hour = localWallHour(startIso, timezone);
  if (hour >= 0 && hour < 5) return true;
  if (hour >= 23) return true;
  if (
    typeof expectedStartHour === 'number' &&
    Math.abs(hour - expectedStartHour) >= 3 &&
    expectedStartHour >= 6 &&
    expectedStartHour <= 14
  ) {
    return true;
  }
  return false;
}

export function clampHour(value: unknown, fallback: number, min = 0, max = 23): number {
  const n = typeof value === 'number' ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeMarketHours(
  startHour: number,
  endHour: number,
  marketType?: string | null,
): { startHour: number; endHour: number } {
  let start = clampHour(startHour, 8, 0, 23);
  let end = clampHour(endHour, 13, 1, 23);

  const isFarmers =
    !marketType ||
    marketType === 'farmers_market' ||
    marketType === 'on_farm_market' ||
    marketType === 'public_market';

  if (isFarmers) {
    if (start < 5) start = 8;
    if (start > 14) start = 9;
    if (end < 8) end = 13;
    if (end > 22) end = 14;
  }

  if (end <= start) end = Math.min(23, start + 5);

  return { startHour: start, endHour: end };
}

export function normalizeDays(days: string[] | undefined): string[] {
  if (!days?.length) return ['saturday'];
  const normalized = [...new Set(days.map((d) => d.toLowerCase().trim()).filter((d) => VALID_DAYS.has(d)))];
  return normalized.length > 0 ? normalized : ['saturday'];
}
