/**
 * Tender mix helpers — map raw pos_transactions payloads to rollup breakdowns.
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §5
 */

import type {
  LedgerTenderType,
  PaymentMethodDistribution,
  PosSnapshotRollupJobData,
  PosTransactionTenderRow,
  SnapshotRollupBatchInput,
  TenderBreakdown,
} from '../types/ledger-transaction';

const TENDER_KEYS: LedgerTenderType[] = [
  'card',
  'cash',
  'gift_card',
  'digital_wallet',
  'other',
];

function normalizeTenderKey(value: string | undefined): LedgerTenderType {
  const key = (value ?? '').toLowerCase();
  if (key === 'card') return 'card';
  if (key === 'cash') return 'cash';
  if (key === 'gift_card' || key === 'giftcard') return 'gift_card';
  if (key === 'digital_wallet' || key === 'wallet') return 'digital_wallet';
  return 'other';
}

function mapSquareSourceType(sourceType: string | undefined): LedgerTenderType {
  const normalized = (sourceType ?? '').toUpperCase();
  if (normalized === 'CASH') return 'cash';
  if (normalized === 'CARD') return 'card';
  if (normalized === 'WALLET' || normalized === 'SQUARE_ACCOUNT') return 'digital_wallet';
  if (normalized === 'BANK_ACCOUNT') return 'other';
  return 'card';
}

function isRefundPayload(rawPayload: Record<string, unknown>): boolean {
  if (rawPayload.squareObject === 'refund') return true;
  const state = rawPayload.state;
  if (typeof state === 'string' && state.toLowerCase() === 'refunded') return true;
  return false;
}

/**
 * Safely extract tender classification from a stored pos_transactions.raw_payload.
 * Returns null for refunds so they are excluded from tender mix calculations.
 */
export function extractTenderType(rawPayload: Record<string, unknown>): LedgerTenderType | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  if (isRefundPayload(rawPayload)) return null;

  const direct = rawPayload.tenderType;
  if (typeof direct === 'string') {
    return normalizeTenderKey(direct);
  }

  if (rawPayload.squareObject === 'payment') {
    const payment = rawPayload.payment as { source_type?: string } | undefined;
    return mapSquareSourceType(payment?.source_type);
  }

  const payment = rawPayload.payment as { source_type?: string } | undefined;
  if (payment?.source_type) {
    return mapSquareSourceType(payment.source_type);
  }

  return 'other';
}

/**
 * Scan ledger rows for a UTC day and build the absolute tender baseline breakdown.
 * Refunds are excluded via extractTenderType().
 */
export function aggregateTenderBreakdown(transactions: PosTransactionTenderRow[]): TenderBreakdown {
  const breakdown: TenderBreakdown = {};

  for (const row of transactions) {
    const tender = extractTenderType(row.raw_payload ?? {});
    if (!tender) continue;
    breakdown[tender] = (breakdown[tender] ?? 0) + 1;
  }

  return breakdown;
}

/**
 * Additive merge for debounced duplicate rollup jobs — never overwrites with lower counts.
 */
export function mergeTenderBreakdown(
  existing: TenderBreakdown | undefined,
  delta: TenderBreakdown | undefined,
): TenderBreakdown {
  const merged: TenderBreakdown = { ...(existing ?? {}) };

  for (const [key, count] of Object.entries(delta ?? {})) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const next = Math.trunc(count);
    merged[key] = Math.max(merged[key] ?? 0, 0) + next;
  }

  return merged;
}

/**
 * Convert absolute tender counts to fractional payment_method_distribution ratios.
 * Example: `{ card: 0.72, cash: 0.18, other: 0.10 }`
 */
export function computeTenderDistribution(breakdown: TenderBreakdown): PaymentMethodDistribution {
  const total = Object.values(breakdown).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  if (total <= 0) return {};

  const out: PaymentMethodDistribution = {};

  for (const key of TENDER_KEYS) {
    const count = breakdown[key] ?? 0;
    if (count > 0) {
      out[key] = Math.round((count / total) * 10_000) / 10_000;
    }
  }

  for (const [key, count] of Object.entries(breakdown)) {
    if (TENDER_KEYS.includes(key as LedgerTenderType)) continue;
    if (count > 0) {
      out[key] = Math.round((count / total) * 10_000) / 10_000;
    }
  }

  return out;
}

/**
 * Map an incoming webhook ingest batch into PosSnapshotRollupJobData[] grouped per UTC day.
 */
export function buildSnapshotRollupJobs(batch: SnapshotRollupBatchInput): PosSnapshotRollupJobData[] {
  const byDate = new Map<string, TenderBreakdown>();

  for (const txn of batch.transactions) {
    if (txn.state !== 'completed') continue;
    if (!txn.soldAt || txn.soldAt.length < 10) continue;

    const snapshotDate = txn.soldAt.slice(0, 10);
    const tender = txn.tenderType ?? 'other';
    const bucket = byDate.get(snapshotDate) ?? {};
    bucket[tender] = (bucket[tender] ?? 0) + 1;
    byDate.set(snapshotDate, bucket);
  }

  return [...byDate.entries()].map(([snapshotDate, tenderBreakdown]) => ({
    vendorId: batch.vendorId,
    marketId: batch.marketId,
    tenantId: batch.tenantId,
    posConnectionId: batch.posConnectionId,
    snapshotDate,
    tenderBreakdown,
  }));
}

/** Prefer ledger-derived breakdown; fall back to job delta when ledger is empty. */
export function resolveTenderBreakdown(
  fromLedger: TenderBreakdown,
  jobDelta: TenderBreakdown | undefined,
): TenderBreakdown {
  const ledgerTotal = Object.values(fromLedger).reduce((sum, n) => sum + n, 0);
  if (ledgerTotal > 0) return fromLedger;
  return jobDelta ?? {};
}
