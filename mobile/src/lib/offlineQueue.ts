import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vendorly.offline.handoff.queue.v1';

export type OfflineHandoffPayload = {
  /** Internal registration marker. */
  id: string;
  pickup_code: string;
  timestamp: number;
};

function newQueueId(): string {
  return `hq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<OfflineHandoffPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineHandoffPayload[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        typeof row.id === 'string' &&
        typeof row.pickup_code === 'string' &&
        typeof row.timestamp === 'number',
    );
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineHandoffPayload[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Persist a deferred handoff payload for later sync. */
export async function enqueueHandoff(pickupCode: string): Promise<OfflineHandoffPayload> {
  const code = pickupCode.trim().toUpperCase();
  const queue = await readQueue();
  const existing = queue.find((row) => row.pickup_code === code);
  if (existing) return existing;

  const item: OfflineHandoffPayload = {
    id: newQueueId(),
    pickup_code: code,
    timestamp: Date.now(),
  };
  await writeQueue([...queue, item]);
  return item;
}

/** Return all deferred handoff payloads (oldest first). */
export async function getPendingQueue(): Promise<OfflineHandoffPayload[]> {
  const queue = await readQueue();
  return [...queue].sort((a, b) => a.timestamp - b.timestamp);
}

/** Remove a successfully synced queue item by internal id. */
export async function clearSyncedItem(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((row) => row.id !== id));
}

/** Pending count helper for SYNC_PENDING indicators. */
export async function getPendingQueueCount(): Promise<number> {
  return (await getPendingQueue()).length;
}
