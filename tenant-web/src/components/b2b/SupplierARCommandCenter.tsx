'use client';

import { useEffect } from 'react';

import { useSupplierARMetrics } from '@/lib/b2b/useSupplierARMetrics';

export type SupplierARCommandCenterProps = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Supplier Accounts Receivable command center — three-column financial summary.
 * Telemetry: AR_DASHBOARD_RENDERED, METRICS_AGGREGATION_SUCCESS
 */
export function SupplierARCommandCenter({
  accessToken,
  apiBaseUrl = '',
}: SupplierARCommandCenterProps) {
  const { loading, error, sellerVendorId, metrics, counts } =
    useSupplierARMetrics({ accessToken, apiBaseUrl });

  useEffect(() => {
    if (loading || error || !accessToken) return;
    // eslint-disable-next-line no-console
    console.log(
      `AR_DASHBOARD_RENDERED SELLER=${sellerVendorId ?? 'UNKNOWN'} REVENUE_CENTS=${metrics.TOTAL_REVENUE_CENTS} OUTSTANDING_CENTS=${metrics.OUTSTANDING_CAPITAL_CENTS} AT_RISK_CENTS=${metrics.AT_RISK_CAPITAL_CENTS}`,
    );
  }, [
    accessToken,
    error,
    loading,
    metrics.AT_RISK_CAPITAL_CENTS,
    metrics.OUTSTANDING_CAPITAL_CENTS,
    metrics.TOTAL_REVENUE_CENTS,
    sellerVendorId,
  ]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          B2B Accounts Receivable
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Supplier A/R Command Center
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Net-30 wholesale invoice totals for your seller account: collected
          revenue, open receivables, and overdue exposure.
        </p>
      </header>

      {!accessToken ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-amber-200/90">
          AUTHORIZATION_REQUIRED — pass a Supabase Bearer token via{' '}
          <code className="rounded bg-white/10 px-1">access_token</code>.
        </div>
      ) : null}

      {loading ? (
        <p
          className="font-mono text-xs uppercase tracking-widest text-white/50"
          data-testid="ar-dashboard-loading"
        >
          LOADING_AR_METRICS
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && accessToken ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
          data-testid="ar-metrics-grid"
        >
          <article className="border-t border-emerald-400/35 bg-gradient-to-b from-emerald-500/10 to-transparent px-4 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-200/80">
              Total Revenue
            </p>
            <p
              className="mt-3 font-mono text-2xl font-semibold tracking-tight text-emerald-50"
              data-testid="ar-metric-revenue"
            >
              {formatUsdFromCents(metrics.TOTAL_REVENUE_CENTS)}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
              PAID — {counts.PAID} INVOICES
            </p>
          </article>

          <article className="border-t border-amber-400/35 bg-gradient-to-b from-amber-500/10 to-transparent px-4 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-200/80">
              Outstanding Capital
            </p>
            <p
              className="mt-3 font-mono text-2xl font-semibold tracking-tight text-amber-50"
              data-testid="ar-metric-outstanding"
            >
              {formatUsdFromCents(metrics.OUTSTANDING_CAPITAL_CENTS)}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
              PENDING — {counts.PENDING} INVOICES
            </p>
          </article>

          <article className="border-t border-rose-400/35 bg-gradient-to-b from-rose-500/10 to-transparent px-4 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-rose-200/80">
              At-Risk Capital
            </p>
            <p
              className="mt-3 font-mono text-2xl font-semibold tracking-tight text-rose-50"
              data-testid="ar-metric-at-risk"
            >
              {formatUsdFromCents(metrics.AT_RISK_CAPITAL_CENTS)}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
              OVERDUE — {counts.OVERDUE} INVOICES
            </p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
