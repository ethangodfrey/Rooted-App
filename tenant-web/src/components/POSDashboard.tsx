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

import type { PosAnalyticsTransactionRow } from '@/lib/analytics/types';

export interface POSDashboardProps {
  /** Vendor UUID used to query /api/analytics */
  vendorId: string;
  /** Supabase access token (Bearer). When omitted, component expects same-origin cookie proxy. */
  accessToken?: string | null;
  /** Override API base (defaults to same origin). */
  apiBaseUrl?: string;
}

interface DayPoint {
  day: string;
  label: string;
  grossDollars: number;
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function formatUsd(dollars: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars);
}

function formatUsdPrecise(dollars: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(dollars);
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

function buildDailySeries(rows: PosAnalyticsTransactionRow[]): DayPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(row.transaction_created_at);
    const prev = map.get(key) ?? 0;
    map.set(key, prev + centsToDollars(row.total_amount_cents ?? 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, grossDollars]) => ({
      day,
      label: dayLabel(day),
      grossDollars,
    }));
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
      grossCents += row.total_amount_cents ?? 0;
      tipCents += row.tip_amount_cents ?? 0;
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
        <div className="h-8 w-56 animate-pulse rounded bg-stone-200/80" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/60" />
          ))}
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-2xl bg-white/60" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          Point of sale
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
          Sales analytics
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-600">
          Last 30 days from Square, Toast, and Clover — unified via phase47 analytics ingest.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-stone-200/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Gross sales</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-950">
            {formatUsdPrecise(kpis.grossDollars)}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Tips collected</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-950">
            {formatUsdPrecise(kpis.tipDollars)}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Transaction count
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-950">{kpis.count}</p>
        </article>
      </div>

      <div className="mt-6 rounded-2xl border border-stone-200/70 bg-white/85 p-4 shadow-sm backdrop-blur sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-950">Sales trend</h2>
            <p className="text-xs text-ink-400">Daily gross totals</p>
          </div>
        </div>

        {series.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 text-center text-sm text-ink-600">
            No POS sales in the last 30 days yet. Connect Square and sync to populate this chart.
          </div>
        ) : (
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="posSalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                    <stop offset="55%" stopColor="#6366f1" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6b5e52', fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: '#6b5e52', fontSize: 12 }}
                  tickFormatter={(value: number) => formatUsd(value)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e7e0d6',
                    boxShadow: '0 8px 24px rgba(26,20,16,0.08)',
                  }}
                  formatter={(value: number) => [formatUsdPrecise(value), 'Gross']}
                  labelFormatter={(label) => String(label)}
                />
                <Area
                  type="monotone"
                  dataKey="grossDollars"
                  stroke="#6366f1"
                  strokeWidth={2.25}
                  fill="url(#posSalesGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
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
