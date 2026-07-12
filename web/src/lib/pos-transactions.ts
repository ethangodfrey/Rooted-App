import type { AnalyticsRange } from '@/lib/vendor-analytics';
import { supabase } from '@/lib/supabase';
import type {
  PosIntegrationProvider,
  PosLedgerSummary,
  PosTransactionRow,
  VendorPosConnectionPublic,
} from '@/types/pos-transactions';

function rangeStart(range: AnalyticsRange): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (range - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function chartLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export async function fetchVendorPosConnections(
  vendorId: string,
): Promise<VendorPosConnectionPublic[]> {
  const { data, error } = await supabase
    .from('vendor_pos_connections_public')
    .select('*')
    .eq('vendor_id', vendorId);

  if (error) throw new Error(error.message);
  return (data as VendorPosConnectionPublic[]) ?? [];
}

export async function fetchPosTransactions(
  vendorId: string,
  options?: { since?: string; limit?: number },
): Promise<PosTransactionRow[]> {
  let query = supabase
    .from('pos_transactions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('sold_at', { ascending: false });

  if (options?.since) {
    query = query.gte('sold_at', options.since);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as PosTransactionRow[]) ?? [];
}

export function summarizePosTransactions(
  rows: PosTransactionRow[],
  range: AnalyticsRange = 30,
): PosLedgerSummary {
  const start = rangeStart(range);
  const inRange = rows.filter((r) => new Date(r.sold_at) >= start);

  let grossTotal = 0;
  let platformFeeTotal = 0;
  let netTotal = 0;
  const providerMap = new Map<PosIntegrationProvider, { count: number; netTotal: number }>();
  const dailyMap = new Map<string, { net: number; gross: number; fees: number }>();

  for (const row of inRange) {
    grossTotal += row.gross_amount;
    platformFeeTotal += row.platform_fee;
    netTotal += row.net_amount;

    const bucket = providerMap.get(row.provider) ?? { count: 0, netTotal: 0 };
    bucket.count += 1;
    bucket.netTotal += row.net_amount;
    providerMap.set(row.provider, bucket);

    const key = toDateKey(row.sold_at);
    const day = dailyMap.get(key) ?? { net: 0, gross: 0, fees: 0 };
    day.net += row.net_amount;
    day.gross += row.gross_amount;
    day.fees += row.platform_fee;
    dailyMap.set(key, day);
  }

  const dailyNet = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: chartLabel(date),
      net: v.net,
      gross: v.gross,
      fees: v.fees,
    }));

  return {
    grossTotal,
    platformFeeTotal,
    netTotal,
    transactionCount: inRange.length,
    byProvider: [...providerMap.entries()].map(([provider, v]) => ({
      provider,
      count: v.count,
      netTotal: v.netTotal,
    })),
    dailyNet,
  };
}

export function subscribePosTransactions(
  vendorId: string,
  onChange: (row: PosTransactionRow) => void,
): () => void {
  const channel = supabase
    .channel(`pos-transactions-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_transactions',
        filter: `vendor_id=eq.${vendorId}`,
      },
      (payload) => {
        const row = payload.new as PosTransactionRow;
        if (row?.id) onChange(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
