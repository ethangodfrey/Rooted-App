/**
 * Dispute Resolution Engine helpers.
 * Telemetry: DISPUTE_ENGINE_INITIALIZED, ESCROW_FROZEN_ACTIVE
 */

export type DisputeStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'RESOLVED_REFUNDED'
  | 'RESOLVED_RELEASED';

export function formatDisputeEngineInitializedLog(): string {
  return 'DISPUTE_ENGINE_INITIALIZED SERVICE=DisputeService';
}

export function formatEscrowFrozenActiveLog(input?: {
  transactionId?: string;
  disputeId?: string;
}): string {
  const parts = ['ESCROW_FROZEN_ACTIVE'];
  if (input?.transactionId) parts.push(`TX=${input.transactionId}`);
  if (input?.disputeId) parts.push(`DISPUTE=${input.disputeId}`);
  return parts.join(' ');
}

export function normalizeDisputeStatus(
  value: string | null | undefined,
): DisputeStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (
    upper === 'OPEN' ||
    upper === 'IN_REVIEW' ||
    upper === 'RESOLVED_REFUNDED' ||
    upper === 'RESOLVED_RELEASED'
  ) {
    return upper;
  }
  return null;
}

export function isOpenDisputeStatus(status: string | null | undefined): boolean {
  const normalized = normalizeDisputeStatus(status);
  return normalized === 'OPEN' || normalized === 'IN_REVIEW';
}
