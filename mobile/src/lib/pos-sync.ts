import { isApiConfigured } from '@/src/lib/api';
import { formatRelativeTime } from '@/src/lib/format';
import { posApi } from '@/src/lib/pos-api';
import type { PosConnection } from '@/src/types/pos';

export interface PosSyncStatus {
  connection: PosConnection;
  lastSyncedLabel: string;
  autoSyncLabel: string;
  realTimeEnabled: boolean;
}

function activeConnection(connections: PosConnection[]): PosConnection | undefined {
  return connections.find((c) => c.status === 'ACTIVE');
}

/** Single connections fetch for sync status + optional stale sync trigger. */
export async function refreshPosSyncState(): Promise<{
  syncStatus: PosSyncStatus | null;
  triggered: boolean;
}> {
  if (!isApiConfigured) return { syncStatus: null, triggered: false };
  try {
    const connection = activeConnection(await posApi.listConnections());
    if (!connection) return { syncStatus: null, triggered: false };

    const syncStatus: PosSyncStatus = {
      connection,
      lastSyncedLabel: connection.lastSyncedAt
        ? formatRelativeTime(connection.lastSyncedAt)
        : 'never',
      autoSyncLabel: `every ${connection.syncFrequencyMinutes} min`,
      realTimeEnabled: Boolean(connection.metadata?.webhookSubscriptionId),
    };

    const last = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt).getTime()
      : 0;
    const dueMs = connection.syncFrequencyMinutes * 60_000;
    if (last > 0 && Date.now() - last < dueMs) {
      return { syncStatus, triggered: false };
    }

    await posApi.triggerSync(connection.id);
    return { syncStatus, triggered: true };
  } catch {
    return { syncStatus: null, triggered: false };
  }
}

/** Read the vendor's active Square/POS connection sync state. */
export async function getPosSyncStatus(): Promise<PosSyncStatus | null> {
  return (await refreshPosSyncState()).syncStatus;
}

/**
 * Enqueues a sync when the connection is due (same rule as the backend scheduler).
 * Safe to call on screen focus — no-ops when recently synced.
 */
export async function triggerStalePosSync(): Promise<boolean> {
  if (!isApiConfigured) return false;
  try {
    const connection = activeConnection(await posApi.listConnections());
    if (!connection) return false;

    const last = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt).getTime()
      : 0;
    const dueMs = connection.syncFrequencyMinutes * 60_000;
    if (last > 0 && Date.now() - last < dueMs) return false;

    await posApi.triggerSync(connection.id);
    return true;
  } catch {
    return false;
  }
}
