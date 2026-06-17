import type { EventStatus } from '@/types/database';

import {
  formatWeekdayLabel,
  getZonedParts,
  isRecurringMarketEvent,
  msUntilRecurringMarketOpens,
  recurringMarketPhase,
  resolveEventScheduleForEvent,
  resolveEventTimezone,
} from '@/lib/event-schedule';

export type EventRuntimePhase = 'upcoming' | 'live' | 'closed' | 'cancelled';

export interface EventRuntimeFields {
  start_datetime: string;
  end_datetime: string;
  event_status?: EventStatus;
  timezone?: string | null;
  state?: string | null;
  sync_metadata?: Record<string, unknown>;
  hours_summary?: string | null;
}

const PHASE_RANK: Record<EventRuntimePhase, number> = {
  live: 0,
  upcoming: 1,
  closed: 2,
  cancelled: 3,
};

function oneOffEventPhase(startIso: string, endIso: string, now: Date): EventRuntimePhase {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const t = now.getTime();

  if (t >= start && t <= end) return 'live';
  if (t > end) return 'closed';
  return 'upcoming';
}

export function eventRuntimePhase(event: EventRuntimeFields, now: Date): EventRuntimePhase {
  if (event.event_status === 'cancelled') return 'cancelled';

  if (isRecurringMarketEvent(event)) {
    const schedule = resolveEventScheduleForEvent(event);
    const timeZone = resolveEventTimezone(event);
    return recurringMarketPhase(schedule, timeZone, now);
  }

  return oneOffEventPhase(event.start_datetime, event.end_datetime, now);
}

export function sortEventsByRuntime<T extends EventRuntimeFields>(events: T[], now: Date): T[] {
  return [...events].sort((a, b) => {
    const phaseA = eventRuntimePhase(a, now);
    const phaseB = eventRuntimePhase(b, now);
    if (phaseA !== phaseB) return PHASE_RANK[phaseA] - PHASE_RANK[phaseB];
    if (phaseA === 'live') return a.end_datetime.localeCompare(b.end_datetime);
    if (phaseA === 'upcoming') {
      return msUntilEventOpens(a, now) - msUntilEventOpens(b, now);
    }
    if (phaseA === 'closed') return b.end_datetime.localeCompare(a.end_datetime);
    return a.start_datetime.localeCompare(b.start_datetime);
  });
}

function formatDuration(ms: number): string {
  const totalMins = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function msUntilEventOpens(event: EventRuntimeFields, now: Date): number {
  if (isRecurringMarketEvent(event)) {
    const schedule = resolveEventScheduleForEvent(event);
    const timeZone = resolveEventTimezone(event);
    return msUntilRecurringMarketOpens(schedule, timeZone, now);
  }
  return Math.max(0, new Date(event.start_datetime).getTime() - now.getTime());
}

export function eventRuntimeHint(event: EventRuntimeFields, now: Date): string | null {
  const phase = eventRuntimePhase(event, now);

  if (phase === 'cancelled') return 'This event was cancelled';

  if (isRecurringMarketEvent(event)) {
    const schedule = resolveEventScheduleForEvent(event);
    const timeZone = resolveEventTimezone(event);
    const { weekday, hour, minute } = getZonedParts(now, timeZone);
    const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(
      schedule.dayOfWeek.toLowerCase(),
    );
    const endMinutes = schedule.endHour * 60;

    if (phase === 'live') {
      const minsLeft = endMinutes - (hour * 60 + minute);
      return `Open now · closes in ${formatDuration(minsLeft * 60_000)}`;
    }

    const ms = msUntilRecurringMarketOpens(schedule, timeZone, now);
    if (weekday === targetDay) {
      return `Opens today in ${formatDuration(ms)}`;
    }
    return `Next open ${formatWeekdayLabel(schedule.dayOfWeek)} · in ${formatDuration(ms)}`;
  }

  const start = new Date(event.start_datetime).getTime();
  const end = new Date(event.end_datetime).getTime();
  const t = now.getTime();

  if (phase === 'live') return `Open now · ends in ${formatDuration(end - t)}`;
  if (phase === 'upcoming') return `Starts in ${formatDuration(start - t)}`;
  if (phase === 'closed') return 'This event has ended';
  return null;
}

export const EVENT_RUNTIME_LABEL: Record<EventRuntimePhase, string> = {
  live: 'Open now',
  upcoming: 'Upcoming',
  closed: 'Ended',
  cancelled: 'Cancelled',
};

export const EVENT_RUNTIME_SYMBOL: Record<EventRuntimePhase, string> = {
  live: '●',
  upcoming: '◷',
  closed: '◼',
  cancelled: '✕',
};
