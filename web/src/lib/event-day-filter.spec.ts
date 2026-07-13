import { describe, expect, it } from 'vitest';

import {
  eventDatesForWeekStrip,
  eventOccursOnCalendarDay,
  filterEventsByCalendarDay,
  findNearestDayWithEvents,
  formatCalendarDayLabel,
  startOfDay,
  startOfWeek,
} from './event-day-filter';

describe('startOfDay', () => {
  it('zeroes the time portion', () => {
    const input = new Date('2026-07-10T15:30:45.123Z');
    const day = startOfDay(input);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
    expect(day.getSeconds()).toBe(0);
    expect(day.getMilliseconds()).toBe(0);
  });
});

describe('startOfWeek', () => {
  it('returns the Sunday of the current week', () => {
    const thursday = new Date('2026-07-10T12:00:00');
    const weekStart = startOfWeek(thursday);
    expect(weekStart.getDay()).toBe(0);
    expect(weekStart.getDate()).toBe(5);
  });
});

describe('eventOccursOnCalendarDay', () => {
  it('matches one-off events on their start date', () => {
    const event = {
      start_datetime: '2026-07-12T14:00:00.000Z',
      hours_summary: null,
      state: 'IL',
    };
    const day = new Date('2026-07-12T08:00:00');
    expect(eventOccursOnCalendarDay(event, day)).toBe(true);
    expect(eventOccursOnCalendarDay(event, new Date('2026-07-13T08:00:00'))).toBe(false);
  });

  it('matches recurring markets on their scheduled weekday', () => {
    const saturdayMarket = {
      start_datetime: '2026-01-01T12:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
    };
    const saturday = new Date('2026-07-11T12:00:00');
    const sunday = new Date('2026-07-12T12:00:00');
    expect(eventOccursOnCalendarDay(saturdayMarket, saturday)).toBe(true);
    expect(eventOccursOnCalendarDay(saturdayMarket, sunday)).toBe(false);
  });
});

describe('filterEventsByCalendarDay', () => {
  it('returns only events occurring on the selected day', () => {
    const events = [
      { start_datetime: '2026-07-12T14:00:00.000Z', hours_summary: null, state: 'IL' },
      { start_datetime: '2026-07-13T14:00:00.000Z', hours_summary: null, state: 'IL' },
    ];
    const filtered = filterEventsByCalendarDay(events, new Date('2026-07-12T08:00:00'));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].start_datetime).toContain('2026-07-12');
  });

  it('returns an empty array when no events match', () => {
    const events = [
      { start_datetime: '2026-07-13T14:00:00.000Z', hours_summary: null, state: 'IL' },
    ];
    expect(filterEventsByCalendarDay(events, new Date('2026-07-12T08:00:00'))).toEqual([]);
  });
});

describe('findNearestDayWithEvents', () => {
  it('prefers the closest day with events', () => {
    const events = [
      { start_datetime: '2026-07-12T14:00:00.000Z', hours_summary: null, state: 'IL' },
    ];
    const nearest = findNearestDayWithEvents(
      events,
      new Date('2026-07-11T08:00:00'),
      new Date('2026-07-10T08:00:00'),
    );
    expect(nearest).not.toBeNull();
    expect(nearest?.getDate()).toBe(12);
  });

  it('returns null when the strip has no matching events', () => {
    expect(
      findNearestDayWithEvents([], new Date('2026-07-10T08:00:00'), new Date('2026-07-10T08:00:00')),
    ).toBeNull();
  });
});

describe('eventDatesForWeekStrip', () => {
  it('returns ISO timestamps only for days that have events', () => {
    const events = [
      { start_datetime: '2026-07-10T14:00:00.000Z', hours_summary: null, state: 'IL' },
    ];
    const now = new Date('2026-07-10T08:00:00');
    const dates = eventDatesForWeekStrip(events, now, 7);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((iso) => !Number.isNaN(Date.parse(iso)))).toBe(true);
  });

  it('returns an empty array when no events match the strip', () => {
    expect(eventDatesForWeekStrip([], new Date('2026-07-10T08:00:00'), 7)).toEqual([]);
  });
});

describe('formatCalendarDayLabel', () => {
  it('returns a human-readable weekday label', () => {
    const label = formatCalendarDayLabel(new Date('2026-07-12T12:00:00'));
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/Jul/i);
  });
});
