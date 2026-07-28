import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Event } from '@/types/database';

import { fetchFeaturedPublicMarkets, fetchPublicEvents } from './events-query';

const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

function createAwaitableQuery(result: { data: unknown; error: { message: string } | null }) {
  const query = {
    not: mockNot,
    gte: mockGte,
    lte: mockLte,
    limit: mockLimit,
    eq: mockEq,
    order: mockOrder,
    then(
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  mockNot.mockReturnValue(query);
  mockGte.mockReturnValue(query);
  mockLte.mockReturnValue(query);
  mockLimit.mockReturnValue(query);
  mockEq.mockReturnValue(query);
  mockOrder.mockReturnValue(query);

  return query;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Downtown Farmers Market',
    city: 'Chicago',
    state: 'IL',
    address: '123 Main St',
    latitude: 41.8781,
    longitude: -87.6298,
    start_datetime: '2026-07-12T14:00:00.000Z',
    end_datetime: '2026-07-12T20:00:00.000Z',
    timezone: 'America/Chicago',
    event_status: 'scheduled',
    visibility_status: 'public',
    market_type: 'farmers_market',
    hours_summary: 'Sa 08:00-13:00',
    banner_url: null,
    website_url: null,
    extra_info: null,
    sync_metadata: null,
    ...overrides,
  } as Event;
}

describe('fetchPublicEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = createAwaitableQuery({ data: [], error: null });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue(query);
  });

  it('applies a geo bounding box for local map queries near valid coordinates', async () => {
    await fetchPublicEvents({
      scope: 'local',
      near: { latitude: 41.8781, longitude: -87.6298 },
      forMap: true,
    });

    expect(mockGte).toHaveBeenCalledWith('latitude', expect.any(Number));
    expect(mockLte).toHaveBeenCalledWith('latitude', expect.any(Number));
    expect(mockGte).toHaveBeenCalledWith('longitude', expect.any(Number));
    expect(mockLte).toHaveBeenCalledWith('longitude', expect.any(Number));
    expect(mockNot).toHaveBeenCalledWith('latitude', 'is', null);
    expect(mockNot).toHaveBeenCalledWith('longitude', 'is', null);
  });

  it('drops events with invalid coordinates from map results', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: [
          event({ id: 'valid' }),
          event({
            id: 'invalid',
            latitude: null as unknown as number,
            longitude: null as unknown as number,
          }),
        ],
        error: null,
      }),
    );

    const result = await fetchPublicEvents({
      scope: 'local',
      near: { latitude: 41.8781, longitude: -87.6298 },
      forMap: true,
    });

    expect(result.data.map((row) => row.id)).toEqual(['valid']);
    expect(result.error).toBeNull();
  });

  it('returns an error message when Supabase rejects the query', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: null,
        error: { message: 'permission denied' },
      }),
    );

    const result = await fetchPublicEvents({ scope: 'nationwide' });

    expect(result.data).toEqual([]);
    expect(result.error).toBe('permission denied');
  });

  it('ignores invalid near coordinates and falls back to nationwide limits', async () => {
    await fetchPublicEvents({
      scope: 'local',
      near: { latitude: 999, longitude: 0 },
    });

    expect(mockLimit).toHaveBeenCalled();
    expect(mockGte).not.toHaveBeenCalledWith('latitude', expect.any(Number));
  });
});

describe('fetchFeaturedPublicMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = createAwaitableQuery({ data: [], error: null });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue(query);
  });

  it('returns deduped shopper markets up to the requested limit', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: [
          event({ id: 'a', name: 'River Market', city: 'Chicago', start_datetime: '2026-07-12T14:00:00.000Z' }),
          event({ id: 'b', name: 'Oak Grove Market', city: 'Evanston', start_datetime: '2026-07-13T14:00:00.000Z' }),
          event({ id: 'c', name: 'Lakefront Market', city: 'Milwaukee', state: 'WI', start_datetime: '2026-07-14T14:00:00.000Z' }),
        ],
        error: null,
      }),
    );

    const markets = await fetchFeaturedPublicMarkets(2);

    expect(markets).toHaveLength(2);
    expect(markets.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('filters featured markets by normalized state when provided', async () => {
    const query = createAwaitableQuery({ data: [], error: null });
    mockEq.mockReturnValueOnce(query).mockReturnValue(query);

    await fetchFeaturedPublicMarkets(5, { userState: ' il ' });

    expect(mockEq).toHaveBeenCalledWith('state', 'IL');
  });

  it('returns an empty array when the query fails', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: null,
        error: { message: 'network error' },
      }),
    );

    await expect(fetchFeaturedPublicMarkets(5)).resolves.toEqual([]);
  });
});
