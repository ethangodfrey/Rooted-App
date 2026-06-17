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

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const STATE_TIMEZONES: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DC: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  MA: 'America/New_York',
  MD: 'America/New_York',
  ME: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  MS: 'America/Chicago',
  MT: 'America/Denver',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  NE: 'America/Chicago',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NV: 'America/Los_Angeles',
  NY: 'America/New_York',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VA: 'America/New_York',
  VT: 'America/New_York',
  WA: 'America/Los_Angeles',
  WI: 'America/Chicago',
  WV: 'America/New_York',
  WY: 'America/Denver',
};

export interface ResolvedEventSchedule {
  dayOfWeek: string;
  startHour: number;
  endHour: number;
}

export interface EventScheduleFields {
  timezone?: string | null;
  state?: string | null;
  sync_metadata?: Record<string, unknown>;
  hours_summary?: string | null;
}

export function parseOsmOpeningHours(raw: string | null | undefined): ResolvedEventSchedule | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const match = text.match(
    /(Mo|Tu|We|Th|Fr|Sa|Su)[^\d]*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (!match) {
    return { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };
  }

  const dayKey = match[1].toLowerCase();
  const dayOfWeek = WEEKDAY_NAMES[DAY_MAP[dayKey.slice(0, 2)] ?? 6] ?? 'saturday';
  const startHour = Number(match[2]);
  const endHour = Number(match[4]);

  return {
    dayOfWeek,
    startHour: Number.isFinite(startHour) ? startHour : 8,
    endHour: Number.isFinite(endHour) ? endHour : 13,
  };
}

export function resolveEventSchedule(metadata: Record<string, unknown> | undefined): ResolvedEventSchedule {
  const openingHours =
    typeof metadata?.opening_hours === 'string' ? metadata.opening_hours : null;
  const parsed = parseOsmOpeningHours(openingHours);

  const day =
    typeof metadata?.typical_day === 'string'
      ? metadata.typical_day.toLowerCase()
      : parsed?.dayOfWeek ?? 'saturday';

  const startHour =
    typeof metadata?.start_hour === 'number' ? metadata.start_hour : parsed?.startHour ?? 8;

  const endHour =
    typeof metadata?.end_hour === 'number' ? metadata.end_hour : parsed?.endHour ?? 13;

  return { dayOfWeek: day, startHour, endHour };
}

export function resolveEventTimezone(event: EventScheduleFields): string {
  if (event.timezone?.includes('/')) return event.timezone;
  const abbr = (event.state ?? '').trim().toUpperCase().slice(0, 2);
  return STATE_TIMEZONES[abbr] ?? 'America/New_York';
}

export function isRecurringMarketEvent(event: EventScheduleFields): boolean {
  const metadata = event.sync_metadata;
  if (
    metadata &&
    (typeof metadata.opening_hours === 'string' ||
      typeof metadata.typical_day === 'string' ||
      typeof metadata.start_hour === 'number')
  ) {
    return true;
  }
  return parseOsmOpeningHours(event.hours_summary) != null;
}

export function resolveEventScheduleForEvent(event: EventScheduleFields): ResolvedEventSchedule {
  const metadata = event.sync_metadata;
  if (
    metadata &&
    (typeof metadata.opening_hours === 'string' ||
      typeof metadata.typical_day === 'string' ||
      typeof metadata.start_hour === 'number')
  ) {
    return resolveEventSchedule(metadata);
  }
  return parseOsmOpeningHours(event.hours_summary) ?? resolveEventSchedule(metadata);
}

export function getZonedParts(
  date: Date,
  timeZone: string,
): { weekday: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdayMap[parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'] ?? 0,
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

export function recurringMarketPhase(
  schedule: ResolvedEventSchedule,
  timeZone: string,
  now: Date,
): 'live' | 'upcoming' {
  const targetDay = WEEKDAY_TO_JS[schedule.dayOfWeek.toLowerCase()] ?? 6;
  const { weekday, hour, minute } = getZonedParts(now, timeZone);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = schedule.startHour * 60;
  const endMinutes = schedule.endHour * 60;

  if (weekday === targetDay && nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return 'live';
  }

  return 'upcoming';
}

export function msUntilRecurringMarketOpens(
  schedule: ResolvedEventSchedule,
  timeZone: string,
  now: Date,
): number {
  const targetDay = WEEKDAY_TO_JS[schedule.dayOfWeek.toLowerCase()] ?? 6;
  const { weekday, hour, minute } = getZonedParts(now, timeZone);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = schedule.startHour * 60;
  const endMinutes = schedule.endHour * 60;

  let daysAhead = (targetDay - weekday + 7) % 7;
  if (daysAhead === 0) {
    if (nowMinutes < startMinutes) {
      return (startMinutes - nowMinutes) * 60_000;
    }
    if (nowMinutes >= endMinutes) {
      daysAhead = 7;
    } else {
      return 0;
    }
  }

  const minutesUntilOpen = daysAhead * 24 * 60 + (startMinutes - nowMinutes);
  return Math.max(0, minutesUntilOpen * 60_000);
}

export function formatWeekdayLabel(dayOfWeek: string): string {
  const key = dayOfWeek.toLowerCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}
