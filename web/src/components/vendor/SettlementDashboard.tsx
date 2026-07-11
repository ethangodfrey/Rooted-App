import { useMemo, type ReactNode } from 'react';

import {
  EmptyChart,
  HorizontalBarChart,
  LegendRow,
  SETTLEMENT_CHART_COLORS,
  SettlementFeeSplitChart,
  SettlementGrossTrendChart,
} from '@/components/analytics/SimpleCharts';
import { SettlementSkeleton } from '@/components/vendor/SettlementSkeleton';
import { formatPrice } from '@/lib/format';
import { buildSettlementChartData } from '@/lib/settlement-charts';
import {
  calculateVendorSettlement,
  PLATFORM_FEE_BPS,
  type SettlementOrderInput,
} from '@/lib/settlement-calculator';

export interface SettlementDashboardProps {
  orders: SettlementOrderInput[];
  loading?: boolean;
  error?: string | null;
  className?: string;
}

const FEE_PERCENT_LABEL = `${PLATFORM_FEE_BPS / 100}%`;

function SettlementMetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: 'gross' | 'fee' | 'net';
}) {
  const accentClasses: Record<typeof accent, string> = {
    gross: 'border-slate-200 bg-white',
    fee: 'border-amber-200/90 bg-amber-50/60',
    net: 'border-emerald-200/90 bg-emerald-50/70',
  };

  const valueClasses: Record<typeof accent, string> = {
    gross: 'text-slate-900',
    fee: 'text-amber-900',
    net: 'text-emerald-900',
  };

  return (
    <article
      className={`flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 shadow-sm ${accentClasses[accent]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${valueClasses[accent]}`}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-slate-600">{hint}</p>
    </article>
  );
}

function SettlementChartPanel({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      {legend ? <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">{legend}</div> : null}
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function SettlementDashboard({
  orders,
  loading = false,
  error = null,
  className = '',
}: SettlementDashboardProps) {
  const settlement = useMemo(() => calculateVendorSettlement(orders), [orders]);
  const chartData = useMemo(() => buildSettlementChartData(orders), [orders]);

  const periodBars = useMemo(
    () =>
      chartData.periods.map((period) => ({
        label: period.label,
        grossCents: period.grossCents,
        platformFeeCents: period.platformFeeCents,
        netCents: period.netCents,
      })),
    [chartData.periods],
  );

  const sizeBucketBars = useMemo(
    () =>
      chartData.sizeBuckets.map((bucket) => ({
        label: bucket.label,
        value: bucket.grossCents,
      })),
    [chartData.sizeBuckets],
  );

  if (loading) {
    return (
      <div className={className}>
        <SettlementSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <section
        className={`min-h-[200px] rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center ${className}`}
      >
        <p className="text-sm font-medium text-rose-800">Could not load settlement totals</p>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </section>
    );
  }

  if (settlement.orderCount === 0) {
    return (
      <section className={`flex flex-col gap-4 ${className}`} aria-label="Vendor settlement summary">
        <section
          className="min-h-[200px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center"
        >
          <p className="text-sm font-medium text-slate-700">No completed orders yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Settlement totals and charts appear after fulfilled market-day pickups.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SettlementChartPanel
            title="Gross volume trend"
            subtitle="Daily or weekly fulfilled-order totals"
          >
            <EmptyChart message="No completed orders to chart yet." />
          </SettlementChartPanel>
          <SettlementChartPanel
            title="Platform fee split"
            subtitle="Net payout vs platform take-rate by period"
          >
            <EmptyChart message="No fee split data yet." />
          </SettlementChartPanel>
        </div>
      </section>
    );
  }

  const feeShare =
    settlement.grossVolumeCents > 0
      ? Math.round((settlement.platformFeeCents / settlement.grossVolumeCents) * 1000) / 10
      : 0;

  const periodSubtitle =
    chartData.granularity === 'week'
      ? 'Weekly gross from fulfilled orders'
      : 'Daily gross from fulfilled orders';

  return (
    <section className={`flex flex-col gap-4 ${className}`} aria-label="Vendor settlement summary">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SettlementMetricCard
          label="Gross volume"
          value={formatPrice(settlement.grossVolumeCents)}
          hint={`${settlement.orderCount} fulfilled order${settlement.orderCount === 1 ? '' : 's'} before fees`}
          accent="gross"
        />
        <SettlementMetricCard
          label="Platform fee"
          value={formatPrice(settlement.platformFeeCents)}
          hint={`${FEE_PERCENT_LABEL} fulfillment fee (${feeShare}% of gross, half-up cents)`}
          accent="fee"
        />
        <SettlementMetricCard
          label="Net payout"
          value={formatPrice(settlement.netVendorCents)}
          hint="Allocation due to your vendor account after platform fee"
          accent="net"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Settlement math</p>
        <p className="mt-1 text-xs tabular-nums text-slate-600">
          {formatPrice(settlement.grossVolumeCents)} gross − {formatPrice(settlement.platformFeeCents)}{' '}
          platform = <span className="font-semibold text-emerald-800">{formatPrice(settlement.netVendorCents)}</span> net
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SettlementChartPanel
          title="Gross volume trend"
          subtitle={periodSubtitle}
          legend={<LegendRow color={SETTLEMENT_CHART_COLORS.gross} label="Gross volume" />}
        >
          <SettlementGrossTrendChart
            data={periodBars}
            maxValue={chartData.maxPeriodGrossCents}
            formatValue={formatPrice}
          />
        </SettlementChartPanel>

        <SettlementChartPanel
          title="Platform fee split"
          subtitle="Stacked net payout and platform fee by period"
          legend={
            <>
              <LegendRow color={SETTLEMENT_CHART_COLORS.net} label="Net payout" />
              <LegendRow color={SETTLEMENT_CHART_COLORS.platformFee} label="Platform fee" />
            </>
          }
        >
          <SettlementFeeSplitChart
            data={periodBars}
            maxValue={chartData.maxPeriodGrossCents}
            formatValue={formatPrice}
          />
        </SettlementChartPanel>
      </div>

      <SettlementChartPanel
        title="Volume by order size"
        subtitle="Gross cents grouped by transaction size bucket"
        legend={<LegendRow color={SETTLEMENT_CHART_COLORS.bucket} label="Gross volume" />}
      >
        {sizeBucketBars.length === 0 ? (
          <EmptyChart message="No order-size distribution yet." />
        ) : (
          <HorizontalBarChart
            data={sizeBucketBars}
            color={SETTLEMENT_CHART_COLORS.bucket}
            formatValue={formatPrice}
          />
        )}
      </SettlementChartPanel>
    </section>
  );
}
