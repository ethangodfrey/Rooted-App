import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchPosTransactions,
  fetchVendorPosConnections,
  posLedgerRangeStart,
  subscribePosTransactions,
  summarizePosTransactions,
} from '@/lib/pos-transactions';
import type { AnalyticsRange } from '@/lib/vendor-analytics';
import { isSupabaseConfigured } from '@/lib/supabase';
import type {
  PosLedgerSummary,
  PosTransactionRow,
  VendorPosConnectionPublic,
} from '@/types/pos-transactions';

export interface UsePosLedgerOptions {
  vendorId: string | undefined;
  range?: AnalyticsRange;
  enabled?: boolean;
}

export interface UsePosLedgerResult {
  connections: VendorPosConnectionPublic[];
  hasActiveConnection: boolean;
  transactions: PosTransactionRow[];
  summary: PosLedgerSummary;
  liveFeed: PosTransactionRow[];
  loading: boolean;
  error: string | null;
  realtimeStatus: string | null;
  refresh: () => Promise<void>;
}

const LIVE_FEED_MAX = 12;

export function usePosLedger({
  vendorId,
  range = 30,
  enabled = true,
}: UsePosLedgerOptions): UsePosLedgerResult {
  const [connections, setConnections] = useState<VendorPosConnectionPublic[]>([]);
  const [transactions, setTransactions] = useState<PosTransactionRow[]>([]);
  const [liveFeed, setLiveFeed] = useState<PosTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);
  const seenIdsRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!vendorId || !enabled || !isSupabaseConfigured) {
      setConnections([]);
      setTransactions([]);
      setLiveFeed([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const start = posLedgerRangeStart(range);

      const [connRows, txnRows] = await Promise.all([
        fetchVendorPosConnections(vendorId),
        fetchPosTransactions(vendorId, { since: start.toISOString(), limit: 500 }),
      ]);

      setConnections(connRows);
      setTransactions(txnRows);
      setLiveFeed(txnRows.slice(0, LIVE_FEED_MAX));
      seenIdsRef.current = new Set(txnRows.map((t) => t.id));
      setError(null);
    } catch (err) {
      setConnections([]);
      setTransactions([]);
      setLiveFeed([]);
      setError(err instanceof Error ? err.message : 'Failed to load POS ledger');
    } finally {
      setLoading(false);
    }
  }, [vendorId, enabled, range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!vendorId || !enabled || !isSupabaseConfigured) return;

    return subscribePosTransactions(
      vendorId,
      (row) => {
        if (seenIdsRef.current.has(row.id)) return;
        seenIdsRef.current.add(row.id);
        setTransactions((prev) => [row, ...prev]);
        setLiveFeed((prev) => [row, ...prev].slice(0, LIVE_FEED_MAX));
      },
      (status) => setRealtimeStatus(status),
    );
  }, [vendorId, enabled]);

  const summary = summarizePosTransactions(transactions, range);

  const hasActiveConnection = connections.some((c) => c.status === 'active');

  return {
    connections,
    hasActiveConnection,
    transactions,
    summary,
    liveFeed,
    loading,
    error,
    realtimeStatus,
    refresh,
  };
}
