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

/** Map day names/abbreviations to JS weekday index (0 = Sunday … 6 = Saturday). */
export function dayNameToIndex(day: string): number | null {
  const normalized = day.trim().toLowerCase().replace(/s$/, '');
  if (normalized in WEEKDAY_TO_JS) {
    return WEEKDAY_TO_JS[normalized];
  }

  const abbrev = normalized.slice(0, 2);
  if (abbrev in DAY_MAP) {
    return DAY_MAP[abbrev];
  }

  return null;
}

function parseHourToken(hourRaw: string, minuteRaw: string | undefined, meridiem?: string): number {
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? 0);
  if (!Number.isFinite(hour)) return 8;

  const suffix = meridiem?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;

  return hour + (Number.isFinite(minute) ? minute / 60 : 0);
}

/** Parse human summaries like "Saturdays 8am–1pm". */
export function parseHumanOpeningHours(raw: string | null | undefined): ResolvedEventSchedule | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const dayMatch = text.match(
    /\b(sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?)\b/i,
  );
  if (!dayMatch) return null;

  const dayOfWeek = dayMatch[1].toLowerCase().replace(/s$/, '');
  const timeMatch = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );

  if (!timeMatch) {
    return { dayOfWeek, startHour: 8, endHour: 13 };
  }

  const startHour = Math.floor(
    parseHourToken(timeMatch[1], timeMatch[2], timeMatch[3] || inferMeridiem(timeMatch[1], timeMatch[3])),
  );
  const endHour = Math.ceil(
    parseHourToken(timeMatch[4], timeMatch[5], timeMatch[6] || inferMeridiem(timeMatch[4], timeMatch[6])),
  );

  return {
    dayOfWeek,
    startHour: Number.isFinite(startHour) ? startHour : 8,
    endHour: Number.isFinite(endHour) ? endHour : 13,
  };
}

function inferMeridiem(hourRaw: string, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return undefined;
  return hour >= 8 && hour <= 11 ? 'am' : hour >= 1 && hour <= 6 ? 'pm' : undefined;
}

function parseHoursText(raw: string | null | undefined): ResolvedEventSchedule | null {
  return parseOsmOpeningHours(raw) ?? parseHumanOpeningHours(raw);
}

/** Best-effort parse of OSM opening_hours (e.g. "Sa 08:00-13:00"). */
export function parseOsmOpeningHours(raw: string | null | undefined): ResolvedEventSchedule | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const match = text.match(
    /(Mo|Tu|We|Th|Fr|Sa|Su)[^\d]*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (!match) return null;

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
  const parsed = parseHoursText(openingHours);

  const typicalDay =
    typeof metadata?.typical_day === 'string' ? metadata.typical_day.toLowerCase() : null;
  const typicalIndex = typicalDay ? dayNameToIndex(typicalDay) : null;
  const parsedIndex = parsed ? dayNameToIndex(parsed.dayOfWeek) : null;

  let day = typicalDay ?? parsed?.dayOfWeek ?? 'saturday';
  if (
    typicalIndex != null &&
    parsedIndex != null &&
    typicalIndex !== parsedIndex &&
    typeof metadata?.opening_hours === 'string'
  ) {
    day = parsed?.dayOfWeek ?? day;
  }

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
      typeof metadata.start_hour === 'number' ||
      Array.isArray(metadata.runs_on_days))
  ) {
    return true;
  }
  return parseHoursText(event.hours_summary) != null;
}

export function resolveEventScheduleForEvent(event: EventScheduleFields): ResolvedEventSchedule {
  const metadata = event.sync_metadata;
  if (
    metadata &&
    (typeof metadata.opening_hours === 'string' ||
      typeof metadata.typical_day === 'string' ||
      typeof metadata.start_hour === 'number' ||
      Array.isArray(metadata.runs_on_days))
  ) {
    return resolveEventSchedule(metadata);
  }
  return parseHoursText(event.hours_summary) ?? resolveEventSchedule(metadata);
}

/** All operating weekdays for a recurring market (0 = Sunday … 6 = Saturday). */
export function resolveOperatingDayIndices(event: EventScheduleFields): number[] {
  const metadata = event.sync_metadata ?? {};

  if (Array.isArray(metadata.runs_on_days)) {
    const fromRuns = metadata.runs_on_days
      .filter((value): value is string => typeof value === 'string')
      .map((value) => dayNameToIndex(value))
      .filter((value): value is number => value != null);
    if (fromRuns.length > 0) {
      return [...new Set(fromRuns)].sort((a, b) => a - b);
    }
  }

  const hoursText =
    (typeof metadata.opening_hours === 'string' ? metadata.opening_hours : null) ??
    event.hours_summary;
  const parsed = parseHoursText(hoursText);
  if (parsed) {
    const index = dayNameToIndex(parsed.dayOfWeek);
    if (index != null) return [index];
  }

  const schedule = resolveEventScheduleForEvent(event);
  return [dayNameToIndex(schedule.dayOfWeek) ?? 6];
}

export function getZonedParts(
  date: Date,
  timeZone: string,
): { weekday: number; hour: number; minute: number } {
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = dayNameToIndex(weekdayName) ?? date.getDay();

  return {
    weekday,
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

export function recurringMarketPhase(
  schedule: ResolvedEventSchedule,
  timeZone: string,
  now: Date,
  operatingDays: number[] = [dayNameToIndex(schedule.dayOfWeek) ?? 6],
): 'live' | 'upcoming' {
  const { weekday, hour, minute } = getZonedParts(now, timeZone);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = schedule.startHour * 60;
  const endMinutes = schedule.endHour * 60;

  if (
    operatingDays.includes(weekday) &&
    nowMinutes >= startMinutes &&
    nowMinutes <= endMinutes
  ) {
    return 'live';
  }

  return 'upcoming';
}

export function msUntilRecurringMarketOpens(
  schedule: ResolvedEventSchedule,
  timeZone: string,
  now: Date,
  operatingDays: number[] = [dayNameToIndex(schedule.dayOfWeek) ?? 6],
): number {
  const { weekday, hour, minute } = getZonedParts(now, timeZone);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = schedule.startHour * 60;
  const endMinutes = schedule.endHour * 60;

  let best: number | null = null;

  for (const targetDay of operatingDays) {
    let daysAhead = (targetDay - weekday + 7) % 7;

    if (daysAhead === 0) {
      if (nowMinutes < startMinutes) {
        const candidate = (startMinutes - nowMinutes) * 60_000;
        best = best == null ? candidate : Math.min(best, candidate);
        continue;
      }
      if (nowMinutes <= endMinutes) {
        return 0;
      }
      daysAhead = 7;
    }

    const minutesUntilOpen = daysAhead * 24 * 60 + (startMinutes - nowMinutes);
    const candidate = Math.max(0, minutesUntilOpen * 60_000);
    best = best == null ? candidate : Math.min(best, candidate);
  }

  return best ?? 0;
}

export function formatWeekdayLabel(dayOfWeek: string): string {
  const key = dayOfWeek.toLowerCase().replace(/s$/, '');
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function nextOperatingDayName(
  schedule: ResolvedEventSchedule,
  operatingDays: number[],
  timeZone: string,
  now: Date,
): string {
  const { weekday } = getZonedParts(now, timeZone);
  const sorted = [...operatingDays].sort((a, b) => a - b);
  const next = sorted.find((day) => day > weekday) ?? sorted[0];
  return WEEKDAY_NAMES[next] ?? schedule.dayOfWeek;
}

/** Instant to format on cards — live recurring markets use today, not seed start_datetime. */
export function resolveEventDisplayInstant(
  event: EventScheduleFields & { start_datetime: string },
  now: Date,
): Date {
  if (!isRecurringMarketEvent(event)) {
    return new Date(event.start_datetime);
  }

  const schedule = resolveEventScheduleForEvent(event);
  const timeZone = resolveEventTimezone(event);
  const operatingDays = resolveOperatingDayIndices(event);
  const phase = recurringMarketPhase(schedule, timeZone, now, operatingDays);

  if (phase === 'live') {
    return now;
  }

  const { hour, minute } = getZonedParts(now, timeZone);
  const nowMinutes = hour * 60 + minute;
  const endMinutes = schedule.endHour * 60;

  for (let offset = 0; offset < 8; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const parts = getZonedParts(probe, timeZone);
    if (!operatingDays.includes(parts.weekday)) continue;

    if (offset === 0 && nowMinutes > endMinutes) continue;

    return probe;
  }

  return new Date(event.start_datetime);
}
