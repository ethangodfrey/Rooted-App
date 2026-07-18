import { describe, expect, it, vi } from 'vitest';

import type { PosTransactionRow } from '@/types/pos-transactions';

import { posLedgerRangeStart, summarizePosTransactions } from './pos-transactions';

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
