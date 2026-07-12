import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchPosTransactions,
  fetchVendorPosConnections,
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
  summary: PosLedgerSummary | null;
  liveFeed: PosTransactionRow[];
  loading: boolean;
  error: string | null;
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
  const seenIdsRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!vendorId || !enabled || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() - range);
      start.setHours(0, 0, 0, 0);

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

    return subscribePosTransactions(vendorId, (row) => {
      if (seenIdsRef.current.has(row.id)) return;
      seenIdsRef.current.add(row.id);
      setTransactions((prev) => [row, ...prev]);
      setLiveFeed((prev) => [row, ...prev].slice(0, LIVE_FEED_MAX));
    });
  }, [vendorId, enabled]);

  const summary =
    transactions.length > 0 || !loading ? summarizePosTransactions(transactions, range) : null;

  const hasActiveConnection = connections.some((c) => c.status === 'active');

  return {
    connections,
    hasActiveConnection,
    transactions,
    summary,
    liveFeed,
    loading,
    error,
    refresh,
  };
}
