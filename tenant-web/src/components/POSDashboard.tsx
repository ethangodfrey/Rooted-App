'use client';

import { useEffect, useMemo, useState } from 'react';
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

export interface POSDashboardProps {
  /** Vendor UUID used to query /api/analytics */
  vendorId: string;
  /** Supabase access token sent as Authorization Bearer. */
  accessToken?: string | null;
  /** Override API base (defaults to same origin). */
  apiBaseUrl?: string;
}

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

function ObsidianTooltip({
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
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/95 px-3 py-2 text-zinc-50 shadow-none backdrop-blur-md">
      <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
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
        const headers: HeadersInit = { Accept: 'application/json' };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        const res = await fetch(
          `${apiBaseUrl}/api/analytics?vendorId=${encodeURIComponent(vendorId)}`,
          { headers },
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
    return () => {
      cancelled = true;
    };
  }, [vendorId, accessToken, apiBaseUrl]);

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
        <div className="h-8 w-56 animate-pulse rounded bg-zinc-200/80" />
        <div className="mt-6 grid gap-4 md:grid-cols-[1.55fr_1fr]">
          <div className="h-40 animate-pulse rounded-xl bg-zinc-950/90" />
          <div className="flex flex-col gap-3">
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-white/70" />
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-white/70" />
          </div>
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-xl bg-white/70" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Point of sale</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Sales analytics
        </h1>
        <p className="mt-2 max-w-xl text-xs font-medium text-zinc-500">
          Last 30 days from Square, Toast, and Clover — unified via phase47 analytics ingest.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
        <article className="flex min-h-[160px] flex-col justify-end rounded-xl border border-zinc-800/60 bg-zinc-950 px-5 py-5 text-zinc-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Gross revenue</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums">
            {formatUsd(kpis.grossDollars)}
          </p>
          <p className="mt-2 text-xs font-medium text-zinc-400">Primary ledger total · 30d window</p>
        </article>

        <div className="flex flex-col gap-3">
          <article className="flex-1 rounded-xl border border-zinc-200/50 bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Total operations
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-zinc-900">
              {kpis.count}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Transaction count</p>
          </article>
          <article className="flex-1 rounded-xl border border-zinc-200/50 bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Active period
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-zinc-900">
              {formatUsd(kpis.tipDollars)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Tips collected</p>
          </article>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200/50 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Trend</p>
            <h2 className="mt-1 text-sm font-semibold text-zinc-900">Sales path</h2>
            <p className="text-xs font-medium text-zinc-500">Daily gross totals</p>
          </div>
        </div>

        {series.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 px-4 text-center text-sm text-zinc-500">
            No POS sales in the last 30 days yet. Connect Square and sync to populate this chart.
          </div>
        ) : (
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="posSalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={(value: number) => formatUsd(value, 0)}
                />
                <Tooltip content={<ObsidianTooltip />} cursor={{ stroke: '#a1a1aa', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="grossDollars"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill="url(#posSalesGradient)"
                  dot={false}
                  activeDot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
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
