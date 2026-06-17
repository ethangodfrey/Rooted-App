import { DateTime } from 'luxon';

import { timezoneForState } from './state-timezones';

const WEEKDAY_TO_LUXON: Record<string, number> = {
  sunday: 7,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Next market window in the market's local timezone, stored as UTC ISO strings. */
export function nextEventWindow(
  dayOfWeek: string,
  startHour: number,
  endHour: number,
  state?: string | null,
): { start: string; end: string; timezone: string } {
  const timezone = timezoneForState(state);
  const targetLuxon = WEEKDAY_TO_LUXON[dayOfWeek.toLowerCase()] ?? 6;

  const cursor = DateTime.now().setZone(timezone);
  let daysAhead = (targetLuxon - cursor.weekday + 7) % 7;

  if (daysAhead === 0) {
    const endToday = cursor.startOf('day').set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
    if (cursor > endToday) daysAhead = 7;
  }

  const day = cursor.plus({ days: daysAhead }).startOf('day');
  const start = day.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
  const end = day.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });

  return {
    start: start.toUTC().toISO()!,
    end: end.toUTC().toISO()!,
    timezone,
  };
}
