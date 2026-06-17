import { DateTime } from 'luxon';

import { timezoneForState } from './us-state-timezones';

const WEEKDAY_TO_JS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_MAP: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

function jsToLuxonWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Best-effort parse of OSM opening_hours (e.g. "Sa 08:00-13:00"). */
export function parseOsmOpeningHours(raw: string | null | undefined): {
  dayOfWeek: string;
  startHour: number;
  endHour: number;
  summary: string;
} | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const match = text.match(
    /(Mo|Tu|We|Th|Fr|Sa|Su)[^\d]*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (!match) {
    return { dayOfWeek: 'saturday', startHour: 8, endHour: 13, summary: text };
  }

  const dayKey = match[1].toLowerCase();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[DAY_MAP[dayKey.slice(0, 2)] ?? 6] ?? 'saturday';
  const startHour = Number(match[2]);
  const endHour = Number(match[4]);

  return {
    dayOfWeek,
    startHour: Number.isFinite(startHour) ? startHour : 8,
    endHour: Number.isFinite(endHour) ? endHour : 13,
    summary: text,
  };
}

export function inferMarketType(name: string, tags: Record<string, string>): string {
  const hay = `${name} ${tags.description ?? ''} ${tags.marketplace ?? ''}`.toLowerCase();
  if (tags.marketplace === 'farmers_market') return 'farmers_market';
  if (/flea/.test(hay)) return 'flea_market';
  if (/craft|artisan|makers/.test(hay)) return 'craft_market';
  if (/public market|greenmarket/.test(hay)) return 'public_market';
  if (/farmers?\s*market|farm\s*market/.test(hay)) return 'farmers_market';
  if (/market/.test(hay)) return 'mixed';
  return 'unknown';
}

/**
 * Next occurrence of a recurring market in the market's local timezone.
 * Uses today's session when the market is still open or hasn't started yet today.
 * Returns UTC instants suitable for timestamptz storage.
 */
export function nextMarketWindow(
  dayOfWeek = 'saturday',
  startHour = 8,
  endHour = 13,
  stateOrTimezone?: string | null,
  reference: DateTime = DateTime.now(),
): { start: Date; end: Date; timezone: string } {
  const timezone =
    stateOrTimezone?.includes('/') ? stateOrTimezone : timezoneForState(stateOrTimezone);

  const targetJs = WEEKDAY_TO_JS[dayOfWeek.toLowerCase()] ?? 6;
  const targetLuxon = jsToLuxonWeekday(targetJs);

  const cursor = reference.setZone(timezone);
  let daysAhead = (targetLuxon - cursor.weekday + 7) % 7;

  if (daysAhead === 0) {
    const endToday = cursor
      .startOf('day')
      .set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
    if (cursor > endToday) {
      daysAhead = 7;
    }
  }

  const day = cursor.plus({ days: daysAhead }).startOf('day');
  const start = day.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
  const end = day.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });

  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
    timezone,
  };
}
