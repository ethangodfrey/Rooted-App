import { api } from '@/lib/api';

/**
 * Phase 8 Dispute Resolution client.
 * Telemetry: DISPUTE_ENGINE_INITIALIZED, ESCROW_FROZEN_ACTIVE
 */

export type DisputeItem = {
  id: string;
  transactionId: string;
  initiatorId: string;
  reason: string;
  status: string;
  createdAt: string;
  amountCents: number;
  netAmountCents: number;
  transactionType: string;
  transactionStatus: string;
  referenceId: string | null;
};

export type DisputeQueueResponse = {
  STATUS: string;
  COUNT: number;
  ITEMS: DisputeItem[];
};

export type RaiseDisputeResponse = {
  STATUS: string;
  ACTION: string;
  DISPUTE_ID: string;
  TRANSACTION_ID: string;
  DISPUTE_STATUS: string;
};

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

export async function raiseDispute(input: {
  transactionId: string;
  reason: string;
}): Promise<RaiseDisputeResponse> {
  return api.post('/api/disputes', {
    transaction_id: input.transactionId,
    reason: input.reason,
  });
}

export async function fetchAdminDisputeQueue(
  limit = 50,
): Promise<DisputeQueueResponse> {
  return api.get(`/api/admin/disputes?limit=${limit}`);
}

export async function approveDisputeRefund(
  disputeId: string,
  notes?: string,
): Promise<unknown> {
  return api.post(`/api/admin/disputes/${disputeId}/refund`, { notes });
}

export async function dismissDispute(
  disputeId: string,
  opts?: { notes?: string; settle?: boolean },
): Promise<unknown> {
  return api.post(`/api/admin/disputes/${disputeId}/dismiss`, opts ?? {});
}
