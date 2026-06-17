import { DateTime } from 'luxon';

import { nextMarketWindow } from './market-schedule.util';

function at(iso: string, zone: string): DateTime {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) throw new Error(`Invalid test datetime: ${iso}`);
  return dt;
}

describe('nextMarketWindow', () => {
  const tz = 'America/Chicago';

  it('uses today when the market is currently open', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T10:30:00', tz));

    expect(start.toISOString()).toBe('2026-06-13T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-13T18:00:00.000Z');
  });

  it('uses today when the market has not opened yet', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T07:00:00', tz));

    expect(start.toISOString()).toBe('2026-06-13T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-13T18:00:00.000Z');
  });

  it('uses next week after todays session has ended', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T14:00:00', tz));

    expect(start.toISOString()).toBe('2026-06-20T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-20T18:00:00.000Z');
  });
});
