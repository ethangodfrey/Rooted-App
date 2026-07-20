import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PosTransactionRow } from '@/types/pos-transactions';

import { fetchPosTransactions, posLedgerRangeStart, summarizePosTransactions } from './pos-transactions';

const mockLimit = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

function createAwaitableQuery(result: { data: unknown; error: { message: string } | null }) {
  const query = {
    gte: mockGte,
    limit: mockLimit,
    then(
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  mockGte.mockReturnValue(query);
  mockLimit.mockReturnValue(query);
  return query;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function txn(overrides: Partial<PosTransactionRow> = {}): PosTransactionRow {
  return {
    id: 'txn-1',
    vendor_id: 'vendor-1',
    connection_id: 'conn-1',
    provider: 'square',
    external_transaction_id: 'ext-1',
    gross_amount: 1000,
    platform_fee: 50,
    net_amount: 950,
    currency: 'USD',
    sold_at: '2026-07-10T15:00:00.000Z',
    raw_payload: {},
    created_at: '2026-07-10T15:00:00.000Z',
    updated_at: '2026-07-10T15:00:00.000Z',
    ...overrides,
  };
}

describe('posLedgerRangeStart', () => {
  it('returns midnight at the start of the inclusive analytics window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T15:30:00.000Z'));

    const start = posLedgerRangeStart(7);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(4);

    vi.useRealTimers();
  });

  it('uses a one-day window when range is 1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

    const start = posLedgerRangeStart(1);
    expect(start.getDate()).toBe(10);

    vi.useRealTimers();
  });
});

describe('summarizePosTransactions', () => {
  it('aggregates gross, fees, and net totals for in-range rows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

    const rows = [
      txn({ id: 'a', gross_amount: 1000, platform_fee: 50, net_amount: 950 }),
      txn({
        id: 'b',
        gross_amount: 2000,
        platform_fee: 100,
        net_amount: 1900,
        sold_at: '2026-07-09T12:00:00.000Z',
      }),
      txn({
        id: 'c',
        gross_amount: 5000,
        platform_fee: 250,
        net_amount: 4750,
        sold_at: '2026-06-01T12:00:00.000Z',
      }),
    ];

    const summary = summarizePosTransactions(rows, 7);

    expect(summary).toMatchObject({
      grossTotal: 3000,
      platformFeeTotal: 150,
      netTotal: 2850,
      transactionCount: 2,
    });
    expect(summary.byProvider).toEqual([{ provider: 'square', count: 2, netTotal: 2850 }]);
    expect(summary.dailyNet).toHaveLength(2);

    vi.useRealTimers();
  });

  it('derives net_amount from gross minus fee when net is omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

    const summary = summarizePosTransactions(
      [txn({ net_amount: undefined as unknown as number, gross_amount: 1200, platform_fee: 60 })],
      30,
    );

    expect(summary.netTotal).toBe(1140);

    vi.useRealTimers();
  });

  it('returns zeroed totals for empty input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

    const summary = summarizePosTransactions([], 30);

    expect(summary).toEqual({
      grossTotal: 0,
      platformFeeTotal: 0,
      netTotal: 0,
      transactionCount: 0,
      byProvider: [],
      dailyNet: [],
    });

    vi.useRealTimers();
  });

  it('groups totals by provider', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

    const rows = [
      txn({ id: 'sq', provider: 'square', net_amount: 100 }),
      txn({ id: 'cl', provider: 'clover', net_amount: 200, sold_at: '2026-07-10T13:00:00.000Z' }),
    ];

    const summary = summarizePosTransactions(rows, 30);
    const byProvider = new Map(summary.byProvider.map((p) => [p.provider, p]));

    expect(byProvider.get('square')).toMatchObject({ count: 1, netTotal: 100 });
    expect(byProvider.get('clover')).toMatchObject({ count: 1, netTotal: 200 });

    vi.useRealTimers();
  });
});

describe('fetchPosTransactions normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = createAwaitableQuery({ data: [], error: null });
    mockOrder.mockReturnValue(query);
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('coerces string money fields to integer cents and derives net totals', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            id: 'txn-raw',
            vendor_id: 'vendor-1',
            provider: 'square',
            external_transaction_id: 'ext-raw',
            gross_amount: '1500',
            platform_fee: '75',
            net_amount: undefined,
            currency: 'USD',
            sold_at: '2026-07-10T15:00:00.000Z',
            raw_payload: { source: 'square' },
            created_at: '2026-07-10T15:00:00.000Z',
            updated_at: '2026-07-10T15:00:00.000Z',
          },
        ],
        error: null,
      }),
    );

    const rows = await fetchPosTransactions('vendor-1');

    expect(rows[0]).toMatchObject({
      gross_amount: 1500,
      platform_fee: 75,
      net_amount: 1425,
      provider: 'square',
    });
  });

  it('defaults invalid money values to zero cents', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            id: 'txn-bad',
            gross_amount: 'not-a-number',
            platform_fee: null,
            net_amount: 'also-bad',
            sold_at: '',
          },
        ],
        error: null,
      }),
    );

    const rows = await fetchPosTransactions('vendor-1');

    expect(rows[0]).toMatchObject({
      gross_amount: 0,
      platform_fee: 0,
      net_amount: 0,
      currency: 'USD',
      raw_payload: {},
    });
  });

  it('throws when Supabase returns an error', async () => {
    mockOrder.mockReturnValue(
      createAwaitableQuery({
        data: null,
        error: { message: 'permission denied' },
      }),
    );

    await expect(fetchPosTransactions('vendor-1')).rejects.toThrow('permission denied');
  });
});
