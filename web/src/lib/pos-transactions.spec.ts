import { describe, expect, it, vi, afterEach } from 'vitest';

import { posLedgerRangeStart, summarizePosTransactions } from './pos-transactions';
import type { PosTransactionRow } from '@/types/pos-transactions';

function txn(overrides: Partial<PosTransactionRow> = {}): PosTransactionRow {
  return {
    id: 'txn-1',
    vendor_id: 'vendor-1',
    connection_id: 'conn-1',
    provider: 'square',
    external_transaction_id: 'ext-1',
    gross_amount: 1200,
    platform_fee: 60,
    net_amount: 1140,
    currency: 'USD',
    sold_at: '2026-07-10T12:00:00.000Z',
    raw_payload: {},
    created_at: '2026-07-10T12:00:00.000Z',
    updated_at: '2026-07-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('posLedgerRangeStart', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns midnight at the start of the inclusive analytics window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T18:30:00.000Z'));

    const start = posLedgerRangeStart(7);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(9);
  });
});

describe('summarizePosTransactions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates gross, fees, and net totals for in-range rows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    const summary = summarizePosTransactions(
      [
        txn({ id: 'a', gross_amount: 1000, platform_fee: 50, net_amount: 950 }),
        txn({
          id: 'b',
          gross_amount: 2000,
          platform_fee: 100,
          net_amount: 1900,
          sold_at: '2026-05-01T12:00:00.000Z',
        }),
      ],
      30,
    );

    expect(summary.transactionCount).toBe(1);
    expect(summary.grossTotal).toBe(1000);
    expect(summary.platformFeeTotal).toBe(50);
    expect(summary.netTotal).toBe(950);
    expect(summary.byProvider).toEqual([{ provider: 'square', count: 1, netTotal: 950 }]);
    expect(summary.dailyNet).toHaveLength(1);
    expect(summary.dailyNet[0]).toMatchObject({ net: 950, gross: 1000, fees: 50 });
  });

  it('derives net amount when omitted and coerces string money fields via normalization path', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    const summary = summarizePosTransactions(
      [txn({ net_amount: undefined as unknown as number, gross_amount: 500, platform_fee: 25 })],
      30,
    );

    expect(summary.netTotal).toBe(475);
  });

  it('returns zeroed totals for empty input', () => {
    const summary = summarizePosTransactions([], 30);
    expect(summary).toEqual({
      grossTotal: 0,
      platformFeeTotal: 0,
      netTotal: 0,
      transactionCount: 0,
      byProvider: [],
      dailyNet: [],
    });
  });
});
