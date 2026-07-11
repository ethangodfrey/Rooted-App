import {
  getZonedParts,
  isRecurringMarketEvent,
  resolveEventTimezone,
  resolveOperatingDayIndices,
  type EventScheduleFields,
} from '@/lib/event-schedule';

export const WEEK_STRIP_DAYS = 21;

export interface EventDayFields extends EventScheduleFields {
  start_datetime: string;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Whether an event runs on the given local calendar day. */
export function eventOccursOnCalendarDay(event: EventDayFields, calendarDay: Date): boolean {
  const day = startOfDay(calendarDay);

  if (isRecurringMarketEvent(event)) {
    const timeZone = resolveEventTimezone(event);
    const operatingDays = resolveOperatingDayIndices(event);
    const probe = new Date(day);
    probe.setHours(12, 0, 0, 0);
    const { weekday } = getZonedParts(probe, timeZone);
    return operatingDays.includes(weekday);
  }

  return localDayKey(new Date(event.start_datetime)) === localDayKey(day);
}

export function filterEventsByCalendarDay<T extends EventDayFields>(
  events: T[],
  calendarDay: Date,
): T[] {
  return events.filter((event) => eventOccursOnCalendarDay(event, calendarDay));
}

/** ISO timestamps for strip days that have at least one scoped event (for week-strip dots). */
export function eventDatesForWeekStrip(
  events: EventDayFields[],
  now: Date,
  stripDays = WEEK_STRIP_DAYS,
): string[] {
  const weekStart = startOfWeek(now);
  const result: string[] = [];

  for (let i = 0; i < stripDays; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(12, 0, 0, 0);
    if (events.some((event) => eventOccursOnCalendarDay(event, d))) {
      result.push(d.toISOString());
    }
  }

  return result;
}

/** Closest strip day with events, preferring forward dates when tied. */
export function findNearestDayWithEvents(
  events: EventDayFields[],
  fromDay: Date,
  now: Date,
  stripDays = WEEK_STRIP_DAYS,
): Date | null {
  const weekStart = startOfWeek(now);
  const fromMs = startOfDay(fromDay).getTime();
  let best: Date | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < stripDays; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(0, 0, 0, 0);

    if (!events.some((event) => eventOccursOnCalendarDay(event, d))) continue;

    const dist = Math.abs(d.getTime() - fromMs);
    const isForward = d.getTime() >= fromMs;
    const tieBreak = isForward ? 0 : 1;

    if (dist < bestDist || (dist === bestDist && tieBreak === 0)) {
      bestDist = dist;
      best = d;
    }
  }

  return best;
}

export function formatCalendarDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
