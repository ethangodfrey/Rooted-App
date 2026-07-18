import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { verifyHandoffCode } from '@/src/lib/handoff-api';
import {
  clearSyncedItem,
  getPendingQueue,
  type OfflineHandoffPayload,
} from '@/src/lib/offlineQueue';

type SyncListener = (event: {
  status: 'SYNC_PENDING' | 'RETRYING' | 'IDLE' | 'ERROR';
  remaining: number;
  detail?: string;
}) => void;

let started = false;
let draining = false;
let unsubscribeNetInfo: (() => void) | null = null;
const listeners = new Set<SyncListener>();

function emit(
  status: 'SYNC_PENDING' | 'RETRYING' | 'IDLE' | 'ERROR',
  remaining: number,
  detail?: string,
) {
  for (const listener of listeners) {
    listener({ status, remaining, detail });
  }
}

function isOnline(state: NetInfoState | null): boolean {
  if (!state) return false;
  if (state.isConnected !== true) return false;
  // Treat unknown reachability as online so we still attempt drain.
  if (state.isInternetReachable === false) return false;
  return true;
}

/**
 * Drain OFFLINE_QUEUE sequentially via POST /orders/verify-handoff.
 * Stops on hard failures so the remaining backlog retries on next reconnect.
 */
export async function drainHandoffQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    let pending = await getPendingQueue();
    if (pending.length === 0) {
      emit('IDLE', 0);
      return;
    }

    emit('SYNC_PENDING', pending.length, 'OFFLINE_QUEUE');

    while (pending.length > 0) {
      const item = pending[0] as OfflineHandoffPayload;
      emit('RETRYING', pending.length, item.pickup_code);

      try {
        const result = await verifyHandoffCode(item.pickup_code);
        if (result.STATUS === 'SUCCESS' || result.REASON === 'INVALID_OR_ALREADY_REDEEMED') {
          // Already redeemed remotely counts as synced (clear local duplicate).
          await clearSyncedItem(item.id);
        } else {
          emit('ERROR', pending.length, result.REASON);
          break;
        }
      } catch (err) {
        emit(
          'ERROR',
          pending.length,
          err instanceof Error ? err.message.toUpperCase() : 'SYNC_FAILED',
        );
        break;
      }

      pending = await getPendingQueue();
    }

    const remaining = (await getPendingQueue()).length;
    emit(remaining === 0 ? 'IDLE' : 'SYNC_PENDING', remaining);
  } finally {
    draining = false;
  }
}

async function onNetInfoChange(state: NetInfoState) {
  if (!isOnline(state)) {
    const remaining = (await getPendingQueue()).length;
    if (remaining > 0) emit('SYNC_PENDING', remaining, 'OFFLINE_QUEUE');
    return;
  }
  await drainHandoffQueue();
}

/** Subscribe to connectivity and auto-drain the local handoff queue. */
export function startSyncWorker(): () => void {
  if (started) {
    return () => stopSyncWorker();
  }
  started = true;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    void onNetInfoChange(state);
  });

  void NetInfo.fetch().then((state) => {
    void onNetInfoChange(state);
  });

  return () => stopSyncWorker();
}

export function stopSyncWorker(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
  started = false;
}

export function subscribeSyncWorker(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function isDeviceOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isOnline(state);
}
