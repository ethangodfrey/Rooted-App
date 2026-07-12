import { describe, expect, it } from 'vitest';

import {
  EVENT_RUNTIME_LABEL,
  eventRuntimePhase,
  sortEventsByRuntime,
  type EventRuntimeFields,
} from './event-runtime';

function oneOffEvent(overrides: Partial<EventRuntimeFields> = {}): EventRuntimeFields {
  return {
    start_datetime: '2026-07-12T14:00:00.000Z',
    end_datetime: '2026-07-12T18:00:00.000Z',
    ...overrides,
  };
}

describe('eventRuntimePhase', () => {
  it('classifies one-off events as upcoming, live, or closed', () => {
    const event = oneOffEvent();
    const before = new Date('2026-07-12T13:00:00.000Z');
    const during = new Date('2026-07-12T15:00:00.000Z');
    const after = new Date('2026-07-12T19:00:00.000Z');

    expect(eventRuntimePhase(event, before)).toBe('upcoming');
    expect(eventRuntimePhase(event, during)).toBe('live');
    expect(eventRuntimePhase(event, after)).toBe('closed');
  });

  it('returns cancelled when event_status is cancelled', () => {
    const event = oneOffEvent({ event_status: 'cancelled' });
    expect(eventRuntimePhase(event, new Date('2026-07-12T15:00:00.000Z'))).toBe('cancelled');
  });

  it('classifies recurring markets using schedule hours', () => {
    const saturdayMarket: EventRuntimeFields = {
      start_datetime: '2026-01-01T12:00:00.000Z',
      end_datetime: '2026-01-01T18:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
    };

    const saturdayMorning = new Date('2026-07-11T14:00:00.000Z');
    const saturdayAfternoon = new Date('2026-07-11T20:00:00.000Z');
    const sunday = new Date('2026-07-12T14:00:00.000Z');

    expect(eventRuntimePhase(saturdayMarket, saturdayMorning)).toBe('live');
    expect(eventRuntimePhase(saturdayMarket, saturdayAfternoon)).toBe('upcoming');
    expect(eventRuntimePhase(saturdayMarket, sunday)).toBe('upcoming');
  });
});

describe('sortEventsByRuntime', () => {
  it('orders live events first, then upcoming, then closed', () => {
    const live = oneOffEvent({
      start_datetime: '2026-07-12T12:00:00.000Z',
      end_datetime: '2026-07-12T20:00:00.000Z',
    });
    const upcoming = oneOffEvent({
      start_datetime: '2026-07-13T12:00:00.000Z',
      end_datetime: '2026-07-13T18:00:00.000Z',
    });
    const closed = oneOffEvent({
      start_datetime: '2026-07-10T12:00:00.000Z',
      end_datetime: '2026-07-10T18:00:00.000Z',
    });

    const now = new Date('2026-07-12T15:00:00.000Z');
    const sorted = sortEventsByRuntime([closed, upcoming, live], now);

    expect(sorted.map((e) => eventRuntimePhase(e, now))).toEqual(['live', 'upcoming', 'closed']);
  });
});

describe('EVENT_RUNTIME_LABEL', () => {
  it('exposes human-readable labels for each phase', () => {
    expect(EVENT_RUNTIME_LABEL.live).toBe('Open now');
    expect(EVENT_RUNTIME_LABEL.upcoming).toBe('Upcoming');
    expect(EVENT_RUNTIME_LABEL.closed).toBe('Ended');
    expect(EVENT_RUNTIME_LABEL.cancelled).toBe('Cancelled');
  });
});
