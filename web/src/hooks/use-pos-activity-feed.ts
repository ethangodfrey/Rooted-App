import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchPosActivityDashboard } from '@/lib/pos-activity';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { PosActivityDashboardResponse } from '@/types/pos-activity';

const POLL_INTERVAL_MS = 15_000;
const REALTIME_DEBOUNCE_MS = 800;

export interface UsePosActivityFeedOptions {
  vendorId: string | undefined;
  enabled?: boolean;
}

export interface UsePosActivityFeedResult {
  data: PosActivityDashboardResponse | null;
  loading: boolean;
  error: string | null;
  /** True when a background refresh is in flight (initial load uses `loading`). */
  refreshing: boolean;
  lastSyncedAt: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Keeps the POS activity dashboard fresh without full page reloads.
 *
 * Update strategy (layered for efficiency):
 * 1. **Supabase Realtime** — subscribe to `inventory_transactions` INSERTs for this
 *    vendor. When the BullMQ worker finishes a job and writes a row, Postgres
 *    notifies the client; we debounce and call `refresh()` so metrics + feed
 *    stay aligned with the server aggregate.
 * 2. **Polling fallback** — every 15s while the tab is visible, re-fetch the
 *    dashboard. Covers sync-run completions (no inventory row) and environments
 *    where Realtime is unavailable.
 *
 * `refreshing` is true during background updates so the UI can show a subtle
 * pulse without replacing the whole screen with a spinner.
 */
export function usePosActivityFeed({
  vendorId,
  enabled = true,
}: UsePosActivityFeedOptions): UsePosActivityFeedResult {
  const [data, setData] = useState<PosActivityDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  const debounceTimerRef = useRef<number | null>(null);
  const initialLoadDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!vendorId || !enabled) return;

    const isInitial = !initialLoadDoneRef.current;
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const next = await fetchPosActivityDashboard();
      if (!mountedRef.current) return;
      setData(next);
      setError(null);
      setLastSyncedAt(new Date());
      initialLoadDoneRef.current = true;
    } catch (err) {
      if (!mountedRef.current) return;
      setError((err as Error).message);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    initialLoadDoneRef.current = false;
    setData(null);
    void refresh();
  }, [refresh]);

  // Polling while tab is visible
  useEffect(() => {
    if (!vendorId || !enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [vendorId, enabled, refresh]);

  // Supabase Realtime: new inventory rows → debounced dashboard refresh
  useEffect(() => {
    if (!vendorId || !enabled || !isSupabaseConfigured) return;

    const scheduleRefresh = () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void refresh();
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`pos-activity-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_transactions',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => scheduleRefresh(),
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [vendorId, enabled, refresh]);

  return { data, loading, error, refreshing, lastSyncedAt, refresh };
}
