import { isApiConfigured } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { posApi } from '@/lib/pos-api';
import type { PosConnection } from '@/types/pos';

export interface PosSyncStatus {
  connection: PosConnection;
  lastSyncedLabel: string;
  autoSyncLabel: string;
  realTimeEnabled: boolean;
}

function activeConnection(connections: PosConnection[]): PosConnection | undefined {
  return connections.find((c) => c.status === 'ACTIVE');
}

export async function getPosSyncStatus(): Promise<PosSyncStatus | null> {
  if (!isApiConfigured) return null;
  try {
    const connection = activeConnection(await posApi.listConnections());
    if (!connection) return null;
    return {
      connection,
      lastSyncedLabel: connection.lastSyncedAt
        ? formatRelativeTime(connection.lastSyncedAt)
        : 'never',
      autoSyncLabel: `every ${connection.syncFrequencyMinutes} min`,
      realTimeEnabled: Boolean(connection.metadata?.webhookSubscriptionId),
    };
  } catch {
    return null;
  }
}

export async function triggerStalePosSync(): Promise<boolean> {
  if (!isApiConfigured) return false;
  try {
    const connection = activeConnection(await posApi.listConnections());
    if (!connection) return false;

    const last = connection.lastSyncedAt ? new Date(connection.lastSyncedAt).getTime() : 0;
    const dueMs = connection.syncFrequencyMinutes * 60_000;
    if (last > 0 && Date.now() - last < dueMs) return false;

    await posApi.triggerSync(connection.id);
    return true;
  } catch {
    return false;
  }
}
