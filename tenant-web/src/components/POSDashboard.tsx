'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { centsToDollars, formatUsd, parseCents } from '@/lib/analytics/money';
import type { PosAnalyticsTransactionRow } from '@/lib/analytics/types';
import type { LowStockProduct } from '@/lib/flash-sale';

export interface POSDashboardProps {
  /** Vendor UUID used to query /api/analytics */
  vendorId: string;
  /** Supabase access token sent as Authorization Bearer. */
  accessToken?: string | null;
  /** Override API base (defaults to same origin). */
  apiBaseUrl?: string;
}

const TACTILE_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

interface DayPoint {
  day: string;
  label: string;
  grossDollars: number;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

function dayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Group by UTC day using integer cents, then convert once to dollars. */
function buildDailySeries(rows: PosAnalyticsTransactionRow[]): DayPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(row.transaction_created_at);
    map.set(key, (map.get(key) ?? 0) + parseCents(row.total_amount_cents));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, grossCents]) => ({
      day,
      label: dayLabel(day),
      grossDollars: centsToDollars(grossCents),
    }));
}

function IndigoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value) || 0;
  return (
    <div className="rounded-xl border border-orange-500/30 bg-[#0b1228]/95 px-3 py-2 text-zinc-50 shadow-none backdrop-blur-md">
      <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
        {label}
      </p>
      <p className="m-0 mt-1 font-mono text-sm font-semibold tracking-tight tabular-nums">
        {formatUsd(value)}
      </p>
    </div>
  );
}

export function POSDashboard({ vendorId, accessToken, apiBaseUrl = '' }: POSDashboardProps) {
  const [rows, setRows] = useState<PosAnalyticsTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }, [accessToken]);

  const loadLowStock = useCallback(async () => {
    if (!vendorId || !accessToken) {
      setLowStock([]);
      return;
    }
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/vendor/low-stock?vendorId=${encodeURIComponent(vendorId)}`,
        { headers: authHeaders() },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        lowStock?: LowStockProduct[];
      } | null;
      if (!res.ok) {
        setLowStock([]);
        return;
      }
      setLowStock(Array.isArray(body?.lowStock) ? body.lowStock : []);
    } catch {
      setLowStock([]);
    }
  }, [vendorId, accessToken, apiBaseUrl, authHeaders]);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      setError('vendorId is required');
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/analytics?vendorId=${encodeURIComponent(vendorId)}`,
          { headers: authHeaders() },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `Analytics request failed (${res.status})`);
        }
        const body = (await res.json()) as { transactions?: PosAnalyticsTransactionRow[] };
        if (!cancelled) {
          setRows(Array.isArray(body.transactions) ? body.transactions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load analytics');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    void loadLowStock();
    return () => {
      cancelled = true;
    };
  }, [vendorId, accessToken, apiBaseUrl, authHeaders, loadLowStock]);

  async function promoteFlashSale(item: LowStockProduct) {
    setPromotingId(item.productId);
    setPromoError(null);
    setPromoMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendor/flash-promo`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          productId: item.productId,
          productName: item.productName,
          unitsLeft: item.walkUpStock,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        badge?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error || `Promo failed (${res.status})`);
      setPromoMessage(body?.badge ?? 'Flash Sale Active');
      setLowStock((prev) =>
        prev.map((row) => ({
          ...row,
          flashActive: row.productId === item.productId,
        })),
      );
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Unable to activate flash promo');
    } finally {
      setPromotingId(null);
    }
  }

  const kpis = useMemo(() => {
    let grossCents = 0;
    let tipCents = 0;
    for (const row of rows) {
      grossCents += parseCents(row.total_amount_cents);
      tipCents += parseCents(row.tip_amount_cents);
    }
    return {
      grossDollars: centsToDollars(grossCents),
      tipDollars: centsToDollars(tipCents),
      count: rows.length,
    };
  }, [rows]);

  const series = useMemo(() => buildDailySeries(rows), [rows]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="h-56 animate-pulse rounded-xl bg-white/10" />
          <div className="flex flex-col gap-3">
            <div className="h-24 animate-pulse rounded-xl bg-white/10" />
            <div className="h-24 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
        <div className="mt-6 h-80 animate-pulse rounded-xl bg-white/10" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-100">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
          Point of sale
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">Sales analytics</h1>
        <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/70 md:text-base">
          Last 30 days from Square, Toast, and Clover — unified via phase47 analytics ingest.
        </p>
      </header>

      {lowStock.length > 0 ? (
        <div className="mb-6 space-y-3">
          {lowStock.map((item) => (
            <div
              key={item.productId}
              className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-4"
            >
              <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
                Low walk-up stock
              </p>
              <p className="m-0 mt-1 text-sm font-semibold text-zinc-50">
                {item.productName} · {item.walkUpStock} left for in-person sales
              </p>
              <p className="m-0 mt-1 text-xs font-medium text-white/65">
                Trigger a flash sale on the shopper directory before the table runs empty.
              </p>
              <button
                type="button"
                className={`${TACTILE_BTN} mt-3`}
                disabled={promotingId === item.productId || item.flashActive}
                onClick={() => void promoteFlashSale(item)}
              >
                {item.flashActive
                  ? 'Flash Sale Active'
                  : promotingId === item.productId
                    ? 'Promoting…'
                    : 'Promote Last 3 Items'}
              </button>
            </div>
          ))}
          {promoMessage ? (
            <p className="m-0 text-sm font-semibold text-orange-400" role="status">
              Live on shopper directory: {promoMessage}
            </p>
          ) : null}
          {promoError ? (
            <p className="m-0 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {promoError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[2fr_1fr] md:grid-rows-[auto]">
        <article className="flex min-h-[280px] flex-col justify-end rounded-xl border border-orange-500/35 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(249,115,22,0.28),transparent_55%),#121a36] px-6 py-7 md:row-span-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
            Gross revenue
          </p>
          <p className="mt-2 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent tabular-nums md:text-6xl">
            {formatUsd(kpis.grossDollars)}
          </p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/65 md:text-base">
            Primary ledger total · 30d window
          </p>
        </article>

        <div className="flex flex-col gap-3 md:row-span-2">
          <article className="flex min-h-[8.5rem] flex-1 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
              Total operations
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums md:text-4xl">
              {kpis.count}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-white/65">Transaction count</p>
          </article>
          <article className="flex min-h-[8.5rem] flex-1 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
              Active period
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums md:text-4xl">
              {formatUsd(kpis.tipDollars)}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-white/65">Tips collected</p>
          </article>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
              Trend
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">Sales path</h2>
            <p className="text-sm font-medium leading-relaxed text-white/65">Daily gross totals</p>
          </div>
        </div>

        {series.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-center text-sm leading-relaxed text-white/65">
            No POS sales in the last 30 days yet. Connect Square and sync to populate this chart.
          </div>
        ) : (
          <div className="h-80 w-full sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="posSalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="70%" stopColor="#ea580c" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} horizontal />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(248,250,252,0.55)', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: 'rgba(248,250,252,0.55)', fontSize: 11 }}
                  tickFormatter={(value: number) => formatUsd(value, 0)}
                />
                <Tooltip
                  content={<IndigoTooltip />}
                  cursor={{ stroke: '#fb923c', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="grossDollars"
                  stroke="#f97316"
                  strokeWidth={1.25}
                  fill="url(#posSalesGradient)"
                  dot={false}
                  activeDot={{ r: 3, fill: '#fb923c', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

export default POSDashboard;
