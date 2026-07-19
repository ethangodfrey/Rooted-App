import { describe, expect, it } from 'vitest';

import {
  EVENT_RUNTIME_LABEL,
  EVENT_RUNTIME_SYMBOL,
  eventRuntimeHint,
  eventRuntimePhase,
  sortEventsByRuntime,
} from './event-runtime';

describe('eventRuntimePhase', () => {
  it('returns cancelled when event_status is cancelled', () => {
    const event = {
      start_datetime: '2026-07-10T12:00:00.000Z',
      end_datetime: '2026-07-10T18:00:00.000Z',
      event_status: 'cancelled' as const,
    };
    expect(eventRuntimePhase(event, new Date('2026-07-10T14:00:00.000Z'))).toBe('cancelled');
  });

  it('classifies one-off events as upcoming, live, or closed', () => {
    const event = {
      start_datetime: '2026-07-10T12:00:00.000Z',
      end_datetime: '2026-07-10T18:00:00.000Z',
    };

    expect(eventRuntimePhase(event, new Date('2026-07-10T10:00:00.000Z'))).toBe('upcoming');
    expect(eventRuntimePhase(event, new Date('2026-07-10T14:00:00.000Z'))).toBe('live');
    expect(eventRuntimePhase(event, new Date('2026-07-10T20:00:00.000Z'))).toBe('closed');
  });

  it('treats recurring markets as live on their operating day during hours', () => {
    const saturdayMarket = {
      start_datetime: '2026-01-01T12:00:00.000Z',
      end_datetime: '2026-01-01T18:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
      timezone: 'America/Chicago',
    };

    const saturdayMiddayChicago = new Date('2026-07-11T17:00:00.000Z');
    expect(eventRuntimePhase(saturdayMarket, saturdayMiddayChicago)).toBe('live');
  });

  it('treats recurring markets outside operating hours as upcoming', () => {
    const saturdayMarket = {
      start_datetime: '2026-01-01T12:00:00.000Z',
      end_datetime: '2026-01-01T18:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
      timezone: 'America/Chicago',
    };

    const saturdayEveningChicago = new Date('2026-07-12T01:00:00.000Z');
    expect(eventRuntimePhase(saturdayMarket, saturdayEveningChicago)).toBe('upcoming');
  });
});

describe('sortEventsByRuntime', () => {
  it('ranks live events before upcoming, then closed, then cancelled', () => {
    const events = [
      {
        id: 'closed',
        start_datetime: '2026-07-01T12:00:00.000Z',
        end_datetime: '2026-07-01T18:00:00.000Z',
      },
      {
        id: 'live',
        start_datetime: '2026-07-10T12:00:00.000Z',
        end_datetime: '2026-07-10T20:00:00.000Z',
      },
      {
        id: 'upcoming',
        start_datetime: '2026-07-20T12:00:00.000Z',
        end_datetime: '2026-07-20T18:00:00.000Z',
      },
      {
        id: 'cancelled',
        start_datetime: '2026-07-15T12:00:00.000Z',
        end_datetime: '2026-07-15T18:00:00.000Z',
        event_status: 'cancelled' as const,
      },
    ];

    const now = new Date('2026-07-10T14:00:00.000Z');
    const sorted = sortEventsByRuntime(events, now).map((e) => e.id);

    expect(sorted).toEqual(['live', 'upcoming', 'closed', 'cancelled']);
  });

  it('sorts upcoming events by soonest opening time', () => {
    const events = [
      {
        id: 'later',
        start_datetime: '2026-07-20T12:00:00.000Z',
        end_datetime: '2026-07-20T18:00:00.000Z',
      },
      {
        id: 'sooner',
        start_datetime: '2026-07-12T12:00:00.000Z',
        end_datetime: '2026-07-12T18:00:00.000Z',
      },
    ];

    const sorted = sortEventsByRuntime(events, new Date('2026-07-10T12:00:00.000Z')).map(
      (e) => e.id,
    );
    expect(sorted).toEqual(['sooner', 'later']);
  });
});

describe('eventRuntimeHint', () => {
  it('returns a cancellation message for cancelled events', () => {
    const hint = eventRuntimeHint(
      {
        start_datetime: '2026-07-10T12:00:00.000Z',
        end_datetime: '2026-07-10T18:00:00.000Z',
        event_status: 'cancelled',
      },
      new Date('2026-07-10T14:00:00.000Z'),
    );
    expect(hint).toBe('This event was cancelled');
  });

  it('describes live one-off events with remaining time', () => {
    const hint = eventRuntimeHint(
      {
        start_datetime: '2026-07-10T12:00:00.000Z',
        end_datetime: '2026-07-10T18:00:00.000Z',
      },
      new Date('2026-07-10T14:00:00.000Z'),
    );
    expect(hint).toMatch(/^Open now · ends in /);
  });

  it('describes closed one-off events', () => {
    const hint = eventRuntimeHint(
      {
        start_datetime: '2026-07-10T12:00:00.000Z',
        end_datetime: '2026-07-10T18:00:00.000Z',
      },
      new Date('2026-07-10T20:00:00.000Z'),
    );
    expect(hint).toBe('This event has ended');
  });
});

describe('EVENT_RUNTIME_LABEL and EVENT_RUNTIME_SYMBOL', () => {
  it('defines labels and symbols for every runtime phase', () => {
    const phases = ['live', 'upcoming', 'closed', 'cancelled'] as const;
    for (const phase of phases) {
      expect(EVENT_RUNTIME_LABEL[phase].length).toBeGreaterThan(0);
      expect(EVENT_RUNTIME_SYMBOL[phase].length).toBeGreaterThan(0);
    }
  });
});
