import type { AnalyticsRange } from '@/lib/vendor-analytics';
import { supabase } from '@/lib/supabase';
import type {
  PosIntegrationProvider,
  PosLedgerSummary,
  PosTransactionRow,
  VendorPosConnectionPublic,
} from '@/types/pos-transactions';

/** Inclusive analytics window aligned with vendor-analytics date bucketing. */
export function posLedgerRangeStart(range: AnalyticsRange): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (range - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function toCents(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function normalizePosTransactionRow(raw: Record<string, unknown>): PosTransactionRow {
  const gross = toCents(raw.gross_amount);
  const fee = toCents(raw.platform_fee);
  const net = toCents(raw.net_amount ?? gross - fee);

  return {
    id: String(raw.id ?? ''),
    vendor_id: String(raw.vendor_id ?? ''),
    connection_id: raw.connection_id != null ? String(raw.connection_id) : null,
    provider: String(raw.provider ?? 'square') as PosIntegrationProvider,
    external_transaction_id: String(raw.external_transaction_id ?? ''),
    gross_amount: gross,
    platform_fee: fee,
    net_amount: net,
    currency: String(raw.currency ?? 'USD'),
    sold_at: String(raw.sold_at ?? ''),
    raw_payload:
      raw.raw_payload && typeof raw.raw_payload === 'object' && !Array.isArray(raw.raw_payload)
        ? (raw.raw_payload as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
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

const CONNECTION_PUBLIC_COLUMNS =
  'id,vendor_id,user_id,provider,provider_merchant_id,provider_location_id,status,token_expires_at,created_at,updated_at';

export async function fetchVendorPosConnections(
  vendorId: string,
): Promise<VendorPosConnectionPublic[]> {
  const viewRes = await supabase
    .from('vendor_pos_connections_public')
    .select(CONNECTION_PUBLIC_COLUMNS)
    .eq('vendor_id', vendorId);

  if (!viewRes.error) {
    return (viewRes.data as VendorPosConnectionPublic[]) ?? [];
  }

  // Fallback when the public view is not yet exposed in PostgREST (tokens omitted).
  const tableRes = await supabase
    .from('vendor_pos_connections')
    .select(CONNECTION_PUBLIC_COLUMNS)
    .eq('vendor_id', vendorId);

  if (tableRes.error) throw new Error(tableRes.error.message);
  return (tableRes.data as VendorPosConnectionPublic[]) ?? [];
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
  return ((data as Record<string, unknown>[]) ?? []).map(normalizePosTransactionRow);
}

export function summarizePosTransactions(
  rows: PosTransactionRow[],
  range: AnalyticsRange = 30,
): PosLedgerSummary {
  const start = posLedgerRangeStart(range);
  const inRange = rows.filter((r) => new Date(r.sold_at) >= start);

  let grossTotal = 0;
  let platformFeeTotal = 0;
  let netTotal = 0;
  const providerMap = new Map<PosIntegrationProvider, { count: number; netTotal: number }>();
  const dailyMap = new Map<string, { net: number; gross: number; fees: number }>();

  for (const row of inRange) {
    const gross = row.gross_amount;
    const fee = row.platform_fee;
    const net = row.net_amount ?? gross - fee;
    grossTotal += gross;
    platformFeeTotal += fee;
    netTotal += net;

    const bucket = providerMap.get(row.provider) ?? { count: 0, netTotal: 0 };
    bucket.count += 1;
    bucket.netTotal += net;
    providerMap.set(row.provider, bucket);

    const key = toDateKey(row.sold_at);
    const day = dailyMap.get(key) ?? { net: 0, gross: 0, fees: 0 };
    day.net += net;
    day.gross += gross;
    day.fees += fee;
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
  onStatus?: (status: string) => void,
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
        const raw = payload.new as Record<string, unknown> | null;
        if (!raw?.id) return;
        onChange(normalizePosTransactionRow(raw));
      },
    )
    .subscribe((status) => {
      onStatus?.(status);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
