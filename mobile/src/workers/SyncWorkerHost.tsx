import { useEffect } from 'react';

import { startSyncWorker } from '@/src/workers/SyncWorker';

/** Mounts the offline handoff sync daemon for the app lifetime. */
export function SyncWorkerHost() {
  useEffect(() => startSyncWorker(), []);
  return null;
}
