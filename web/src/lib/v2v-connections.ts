/**
 * Phase 83b — V2V connection client for Nest `/api/v2v/connections`.
 * Logs use uppercase monospaced tokens (no emoji).
 */

import { api } from '@/lib/api';

export type V2vConnectionStatus = 'none' | 'pending' | 'connected' | 'ignored';

export interface V2vConnectionRow {
  id: string;
  senderId: string;
  receiverId: string;
  status: V2vConnectionStatus | string;
  isFollowing?: boolean;
  receiverIsFollowing?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type V2vUiState =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'connected'
  | 'ignored';

export interface V2vConnectionView {
  row: V2vConnectionRow | null;
  uiState: V2vUiState;
}

export function formatV2vNetworkActiveLog(extra?: string): string {
  return extra ? `V2V_NETWORK_ACTIVE ${extra}` : 'V2V_NETWORK_ACTIVE';
}

export function toV2vView(
  row: V2vConnectionRow | null,
  currentVendorId: string,
): V2vConnectionView {
  if (!row) return { row: null, uiState: 'none' };
  if (row.status === 'connected') return { row, uiState: 'connected' };
  if (row.status === 'ignored') return { row, uiState: 'ignored' };
  if (row.status === 'pending') {
    return {
      row,
      uiState: row.senderId === currentVendorId ? 'pending_sent' : 'pending_received',
    };
  }
  return { row, uiState: 'none' };
}

export async function listV2vConnections(): Promise<V2vConnectionRow[]> {
  const rows = await api.get<V2vConnectionRow[]>('/api/v2v/connections');
  console.log(formatV2vNetworkActiveLog(`COUNT=${rows.length}`));
  return rows;
}

export async function requestV2vConnection(
  receiverVendorId: string,
): Promise<V2vConnectionRow> {
  const row = await api.post<V2vConnectionRow>('/api/v2v/connections', {
    receiverVendorId,
  });
  console.log(formatV2vNetworkActiveLog(`ACTION=REQUESTED ID=${row.id}`));
  return row;
}

export async function acceptV2vConnection(
  connectionId: string,
): Promise<V2vConnectionRow> {
  const row = await api.post<V2vConnectionRow>(
    `/api/v2v/connections/${connectionId}/accept`,
  );
  console.log(formatV2vNetworkActiveLog(`ACTION=ACCEPTED ID=${row.id}`));
  return row;
}

export async function ignoreV2vConnection(
  connectionId: string,
): Promise<V2vConnectionRow> {
  const row = await api.post<V2vConnectionRow>(
    `/api/v2v/connections/${connectionId}/ignore`,
  );
  console.log(formatV2vNetworkActiveLog(`ACTION=IGNORED ID=${row.id}`));
  return row;
}

export function findPairView(
  rows: V2vConnectionRow[],
  currentVendorId: string,
  peerVendorId: string,
): V2vConnectionView {
  const row =
    rows.find(
      (r) =>
        (r.senderId === currentVendorId && r.receiverId === peerVendorId) ||
        (r.senderId === peerVendorId && r.receiverId === currentVendorId),
    ) ?? null;
  return toV2vView(row, currentVendorId);
}

export function countNetworkMetrics(rows: V2vConnectionRow[], vendorId: string) {
  let connections = 0;
  let following = 0;
  let pendingIncoming = 0;
  for (const row of rows) {
    if (row.status === 'connected') connections += 1;
    if (row.status === 'pending' && row.receiverId === vendorId) pendingIncoming += 1;
    const isSender = row.senderId === vendorId;
    if (isSender && row.isFollowing) following += 1;
    if (!isSender && row.receiverIsFollowing) following += 1;
  }
  return { connections, following, pendingIncoming };
}
