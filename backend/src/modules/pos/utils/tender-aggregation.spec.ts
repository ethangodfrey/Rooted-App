import {
  aggregateTenderBreakdown,
  buildSnapshotRollupJobs,
  computeTenderDistribution,
  extractTenderType,
  mergeTenderBreakdown,
  resolveTenderBreakdown,
} from './tender-aggregation';

describe('tender-aggregation', () => {
  describe('extractTenderType', () => {
    it('maps Square card payments', () => {
      expect(
        extractTenderType({
          squareObject: 'payment',
          payment: { source_type: 'CARD' },
        }),
      ).toBe('card');
    });

    it('excludes refunds from tender mix', () => {
      expect(
        extractTenderType({
          squareObject: 'refund',
          refund: { amount_money: { amount: 500 } },
        }),
      ).toBeNull();
    });
  });

  describe('buildSnapshotRollupJobs', () => {
    it('groups completed transactions by UTC day', () => {
      const jobs = buildSnapshotRollupJobs({
        vendorId: 'v1',
        marketId: 'm1',
        transactions: [
          { state: 'completed', soldAt: '2026-07-13T14:00:00Z', tenderType: 'card' },
          { state: 'completed', soldAt: '2026-07-13T18:00:00Z', tenderType: 'cash' },
          { state: 'refunded', soldAt: '2026-07-13T19:00:00Z', tenderType: 'card' },
        ],
      });

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.snapshotDate).toBe('2026-07-13');
      expect(jobs[0]?.tenderBreakdown).toEqual({ card: 1, cash: 1 });
    });
  });

  describe('aggregateTenderBreakdown', () => {
    it('builds absolute counts from ledger rows', () => {
      const breakdown = aggregateTenderBreakdown([
        { raw_payload: { squareObject: 'payment', payment: { source_type: 'CASH' } } },
        { raw_payload: { squareObject: 'payment', payment: { source_type: 'CARD' } } },
        { raw_payload: { squareObject: 'refund', refund: {} } },
      ]);

      expect(breakdown).toEqual({ cash: 1, card: 1 });
    });
  });

  describe('mergeTenderBreakdown', () => {
    it('adds counts without wiping existing keys', () => {
      expect(mergeTenderBreakdown({ card: 2 }, { card: 1, cash: 3 })).toEqual({
        card: 3,
        cash: 3,
      });
    });
  });

  describe('computeTenderDistribution', () => {
    it('returns fractional ratios', () => {
      expect(computeTenderDistribution({ card: 72, cash: 18, other: 10 })).toEqual({
        card: 0.72,
        cash: 0.18,
        other: 0.1,
      });
    });
  });

  describe('resolveTenderBreakdown', () => {
    it('prefers ledger baseline over job delta', () => {
      expect(resolveTenderBreakdown({ card: 5 }, { card: 99 })).toEqual({ card: 5 });
    });

    it('falls back to job delta when ledger is empty', () => {
      expect(resolveTenderBreakdown({}, { cash: 2 })).toEqual({ cash: 2 });
    });
  });
});
