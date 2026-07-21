import { describe, expect, it } from 'vitest';

import type { PresaleCart, PresaleCartMarket } from './presale-cart';
import {
  formatPickupLocation,
  formatPickupSummary,
  pickupSummaryFromCart,
  pickupSummaryFromMarket,
} from './pickup-schedule';

const oneOffMarket = {
  name: 'Lot Twenty Eight',
  city: 'Chicago',
  state: 'IL',
  address: '123 Main St',
  start_datetime: '2026-07-12T14:00:00.000Z',
  end_datetime: '2026-07-12T18:00:00.000Z',
  timezone: 'America/Chicago',
  hours_summary: null,
};

describe('formatPickupLocation', () => {
  it('joins address, city, and state when present', () => {
    expect(formatPickupLocation(oneOffMarket)).toBe('123 Main St, Chicago, IL');
  });

  it('falls back to the market name when address fields are missing', () => {
    expect(
      formatPickupLocation({
        name: 'Downtown Market',
        start_datetime: '2026-07-12T14:00:00.000Z',
      }),
    ).toBe('Downtown Market');
  });

  it('handles empty address parts gracefully', () => {
    expect(
      formatPickupLocation({
        name: 'Pop-up',
        city: 'Austin',
        state: null,
        address: '',
        start_datetime: '2026-07-12T14:00:00.000Z',
      }),
    ).toBe('Austin');
  });
});

describe('formatPickupSummary', () => {
  it('builds a human-readable pickup label for one-off events', () => {
    const summary = formatPickupSummary(oneOffMarket, new Date('2026-07-10T12:00:00.000Z'));
    expect(summary).toMatch(/^Pickup /);
    expect(summary).toContain('Lot Twenty Eight');
    expect(summary).toMatch(/July/);
  });

  it('uses a default location label when the market name is blank', () => {
    const summary = formatPickupSummary(
      {
        name: '   ',
        start_datetime: '2026-07-12T14:00:00.000Z',
      },
      new Date('2026-07-10T12:00:00.000Z'),
    );
    expect(summary).toContain('your market');
  });

  it('supports recurring markets via hours_summary', () => {
    const summary = formatPickupSummary(
      {
        name: 'Saturday Market',
        start_datetime: '2026-01-01T12:00:00.000Z',
        hours_summary: 'Sa 08:00-13:00',
        state: 'IL',
      },
      new Date('2026-07-11T12:00:00.000Z'),
    );
    expect(summary).toContain('Saturday Market');
    expect(summary.length).toBeGreaterThan('Pickup Saturday Market at '.length);
  });
});

describe('pickupSummaryFromCart', () => {
  it('maps cart pickup schedule fields into the summary formatter', () => {
    const cart: PresaleCart = {
      marketId: 'market-1',
      marketName: 'River Farm',
      marketCity: 'Madison',
      marketState: 'WI',
      marketAddress: '1 Farm Rd',
      pickupSchedule: {
        start_datetime: '2026-07-12T14:00:00.000Z',
        end_datetime: '2026-07-12T18:00:00.000Z',
        timezone: 'America/Chicago',
        hours_summary: null,
        sync_metadata: null,
      },
      items: [],
    };

    const summary = pickupSummaryFromCart(cart, new Date('2026-07-10T12:00:00.000Z'));
    expect(summary).toContain('River Farm');
    expect(summary).toMatch(/^Pickup /);
  });
});

describe('pickupSummaryFromMarket', () => {
  it('delegates to formatPickupSummary for presale cart markets', () => {
    const market: PresaleCartMarket = {
      id: 'market-2',
      name: 'East Side Market',
      city: 'Milwaukee',
      state: 'WI',
      address: '200 Lake Dr',
      start_datetime: '2026-07-13T14:00:00.000Z',
      end_datetime: '2026-07-13T18:00:00.000Z',
      timezone: 'America/Chicago',
      hours_summary: null,
      sync_metadata: null,
    };

    expect(pickupSummaryFromMarket(market, new Date('2026-07-10T12:00:00.000Z'))).toContain(
      'East Side Market',
    );
  });
});
