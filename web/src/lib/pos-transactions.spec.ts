import { describe, expect, it, vi } from 'vitest';

import { posLedgerRangeStart, summarizePosTransactions } from './pos-transactions';
import type { PosTransactionRow } from '@/types/pos-transactions';

function row(overrides: Partial<PosTransactionRow> = {}): PosTransactionRow {
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
  it('returns midnight at the start of the inclusive analytics window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T15:30:00.000Z'));

    const start = posLedgerRangeStart(7);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(10);

    vi.useRealTimers();
  });
});

describe('summarizePosTransactions', () => {
  it('aggregates gross, fees, and net totals for in-range rows', () => {
    const summary = summarizePosTransactions(
      [
        row({ gross_amount: 1000, platform_fee: 50, net_amount: 950 }),
        row({ id: 'txn-2', gross_amount: 2000, platform_fee: 100, net_amount: 1900 }),
      ],
      30,
    );

    expect(summary).toMatchObject({
      grossTotal: 3000,
      platformFeeTotal: 150,
      netTotal: 2850,
      transactionCount: 2,
    });
  });

  it('derives net from gross minus fee when net_amount is missing', () => {
    const summary = summarizePosTransactions(
      [row({ gross_amount: 500, platform_fee: 25, net_amount: undefined as never })],
      30,
    );

    expect(summary.netTotal).toBe(475);
  });

  it('ignores rows outside the selected analytics range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    const summary = summarizePosTransactions(
      [
        row({ sold_at: '2026-07-15T12:00:00.000Z' }),
        row({ id: 'old', sold_at: '2025-01-01T12:00:00.000Z', gross_amount: 9999 }),
      ],
      7,
    );

    expect(summary.transactionCount).toBe(1);
    expect(summary.grossTotal).toBe(1200);

    vi.useRealTimers();
  });

  it('returns zeroed totals for an empty ledger', () => {
    expect(summarizePosTransactions([], 30)).toMatchObject({
      grossTotal: 0,
      platformFeeTotal: 0,
      netTotal: 0,
      transactionCount: 0,
      byProvider: [],
      dailyNet: [],
    });
  });
});
