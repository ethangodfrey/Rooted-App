/**
 * Tender mix helpers — map raw pos_transactions payloads to rollup breakdowns.
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §5
 */

import type { LedgerTenderType } from '../types/ledger-transaction';

const TENDER_KEYS: LedgerTenderType[] = [
  'card',
  'cash',
  'gift_card',
  'digital_wallet',
  'other',
];

export interface PosTransactionTenderRow {
  raw_payload: Record<string, unknown>;
}

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

/** Extract tender classification from a stored pos_transactions.raw_payload blob. */
export function extractTenderType(rawPayload: Record<string, unknown>): LedgerTenderType | null {
  const direct = rawPayload.tenderType;
  if (typeof direct === 'string') {
    return normalizeTenderKey(direct);
  }

  const squareObject = rawPayload.squareObject;
  if (squareObject === 'refund') {
    return null;
  }

  if (squareObject === 'payment') {
    const payment = rawPayload.payment as { source_type?: string } | undefined;
    return mapSquareSourceType(payment?.source_type);
  }

  const payment = rawPayload.payment as { source_type?: string } | undefined;
  if (payment?.source_type) {
    return mapSquareSourceType(payment.source_type);
  }

  return 'other';
}

/** Sum absolute tender counts from ledger rows (payments only; refunds excluded). */
export function aggregateTenderBreakdown(
  rows: PosTransactionTenderRow[],
): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const row of rows) {
    const tender = extractTenderType(row.raw_payload ?? {});
    if (!tender) continue;
    breakdown[tender] = (breakdown[tender] ?? 0) + 1;
  }

  return breakdown;
}

/** Merge incremental webhook-batch counts into an existing breakdown map. */
export function mergeTenderBreakdown(
  base: Record<string, number> | undefined,
  delta: Record<string, number> | undefined,
): Record<string, number> {
  const merged: Record<string, number> = { ...(base ?? {}) };
  for (const [key, count] of Object.entries(delta ?? {})) {
    if (!Number.isFinite(count) || count <= 0) continue;
    merged[key] = (merged[key] ?? 0) + Math.trunc(count);
  }
  return merged;
}

/** Convert absolute counts to fractional payment_method_distribution (4 decimal places). */
export function computeTenderDistribution(
  breakdown: Record<string, number>,
): Record<string, number> {
  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return {};

  const out: Record<string, number> = {};
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

/** Build per-day rollup job payloads from a parsed webhook ingest batch. */
export function buildSnapshotRollupJobs(input: {
  vendorId: string;
  marketId: string;
  tenantId?: string | null;
  posConnectionId?: string | null;
  transactions: Array<{
    state: string;
    soldAt: string;
    tenderType?: LedgerTenderType;
  }>;
}): Array<{
  vendorId: string;
  marketId: string;
  tenantId?: string | null;
  posConnectionId?: string | null;
  snapshotDate: string;
  tenderBreakdown: Record<string, number>;
}> {
  const byDate = new Map<string, Record<string, number>>();

  for (const txn of input.transactions) {
    if (txn.state !== 'completed') continue;
    const snapshotDate = txn.soldAt.slice(0, 10);
    const tender = txn.tenderType ?? 'other';
    const bucket = byDate.get(snapshotDate) ?? {};
    bucket[tender] = (bucket[tender] ?? 0) + 1;
    byDate.set(snapshotDate, bucket);
  }

  return [...byDate.entries()].map(([snapshotDate, tenderBreakdown]) => ({
    vendorId: input.vendorId,
    marketId: input.marketId,
    tenantId: input.tenantId,
    posConnectionId: input.posConnectionId,
    snapshotDate,
    tenderBreakdown,
  }));
}
