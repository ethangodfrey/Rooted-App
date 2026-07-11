import {
  isRecurringMarketEvent,
  resolveEventDisplayInstant,
  resolveEventTimezone,
  type EventScheduleFields,
} from '@/src/lib/event-schedule';

/** Format a price stored in cents as USD, e.g. 1250 -> "$12.50". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
};

/** Format a calendar date using stable en-US month/weekday labels. */
export function formatLocalDate(date: Date, timeZone?: string | null): string {
  return date.toLocaleDateString('en-US', {
    ...SHORT_DATE,
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatEventDate(iso: string, timeZone?: string | null): string {
  return formatLocalDate(new Date(iso), timeZone);
}

/** Market card date — uses today's calendar day for live recurring markets. */
export function formatEventDisplayDate(
  event: EventScheduleFields & {
    start_datetime: string;
    timezone?: string | null;
    state?: string | null;
  },
  now: Date = new Date(),
): string {
  const timeZone = resolveEventTimezone(event);
  const instant = isRecurringMarketEvent(event)
    ? resolveEventDisplayInstant(event, now)
    : new Date(event.start_datetime);
  return formatLocalDate(instant, timeZone);
}

export function formatEventTimeRange(startIso: string, endIso: string, timeZone?: string | null): string {
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  };
  const suffix = timeZone ? ` ${formatTimezoneLabel(timeZone)}` : '';
  return `${new Date(startIso).toLocaleTimeString('en-US', timeOpts)} – ${new Date(endIso).toLocaleTimeString('en-US', timeOpts)}${suffix}`;
}

/** Time range for market cards/detail — schedule hours from seed datetimes. */
export function formatEventDisplayTimeRange(
  event: EventScheduleFields & {
    start_datetime: string;
    end_datetime: string;
    timezone?: string | null;
    state?: string | null;
  },
): string {
  const timeZone = resolveEventTimezone(event);
  return formatEventTimeRange(event.start_datetime, event.end_datetime, timeZone);
}

function formatTimezoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function formatEventFullDate(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Detail-page date — uses the next occurrence for live recurring markets. */
export function formatEventDisplayFullDate(
  event: EventScheduleFields & {
    start_datetime: string;
    timezone?: string | null;
    state?: string | null;
  },
  now: Date = new Date(),
): string {
  const timeZone = resolveEventTimezone(event);
  const instant = isRecurringMarketEvent(event)
    ? resolveEventDisplayInstant(event, now)
    : new Date(event.start_datetime);
  return instant.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Live clock for the events UI — date + time, updates every second. */
export function formatCurrentClock(now: Date): string {
  return now.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
