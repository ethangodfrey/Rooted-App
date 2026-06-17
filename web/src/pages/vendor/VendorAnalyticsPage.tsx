import { useCallback, useEffect, useState } from 'react';

import {
  ChartCard,
  DonutChart,
  EmptyChart,
  HorizontalBarChart,
  LegendRow,
  PieLegend,
  StackedRevenueChart,
  VerticalBarChart,
} from '@/components/analytics/SimpleCharts';
import '@/components/analytics/analytics.css';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import {
  ANALYTICS_COLORS,
  centsToChartValue,
  loadVendorAnalytics,
  maxChartValue,
  type AnalyticsRange,
  type VendorAnalyticsData,
} from '@/lib/vendor-analytics';
import type { OrderStatus } from '@/types/database';
import type { PosImportedTransaction } from '@/types/pos';
import '@/components/ui/ui.css';

const RANGES: AnalyticsRange[] = [7, 30, 90, 365];

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  submitted: '#9CAF88',
  pending_review: '#74c69d',
  accepted: '#52b788',
  preparing: '#50C878',
  ready_for_pickup: '#228B22',
  fulfilled: '#1b6b1b',
  cancelled: '#b7e4c7',
  declined: '#d4e8d4',
};

function formatTender(txn: PosImportedTransaction): string {
  if (txn.cardBrand) return txn.cardBrand;
  if (txn.tenderType) return txn.tenderType.replace(/_/g, ' ').toLowerCase();
  return 'Card';
}

function downloadCsv(metrics: VendorAnalyticsData) {
  const lines: string[] = ['Metric,Value'];
  lines.push(`Reservation revenue,${(metrics.reservationRevenue / 100).toFixed(2)}`);
  lines.push(`In-person revenue,${(metrics.inPersonRevenue / 100).toFixed(2)}`);
  lines.push(`Card sales (POS) revenue,${(metrics.cardSalesRevenue / 100).toFixed(2)}`);
  lines.push(`Card sales (POS) count,${metrics.cardSalesCount}`);
  lines.push(`Units sold,${metrics.unitsSold}`);
  lines.push('');
  lines.push('Order status,Count');
  for (const s of metrics.ordersByStatus) {
    lines.push(`${ORDER_STATUS_LABEL[s.status]},${s.count}`);
  }
  lines.push('');
  lines.push('Top product,Units,Revenue');
  for (const p of metrics.topProducts) {
    lines.push(`${p.name.replace(/,/g, ' ')},${p.units},${(p.revenue / 100).toFixed(2)}`);
  }
  if (metrics.recentPosSales.length > 0) {
    lines.push('');
    lines.push('POS sale,Date,Amount,Tender,Line items');
    for (const txn of metrics.recentPosSales) {
      const items = txn.lineItems
        .map((li) => {
          const label = li.product?.name ?? li.name;
          return `${label} x${li.quantity}`;
        })
        .join('; ');
      lines.push(
        `${txn.id},${formatDateTime(txn.soldAt)},${(txn.netAmount / 100).toFixed(2)},${formatTender(txn)},"${items.replace(/"/g, '""')}"`,
      );
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rooted-analytics.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function VendorAnalyticsPage() {
  const { vendor } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<VendorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await loadVendorAnalytics(vendor.id, range);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [vendor, range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  const hasRevenue =
    data.cardSalesRevenue > 0 || data.reservationRevenue > 0 || data.inPersonRevenue > 0;

  const maxRevenueCents = maxChartValue(data.dailyRevenue.map((d) => d.total));

  const maxUnits = maxChartValue(data.dailyUnits.map((d) => d.units));

  const topByUnits = data.topProducts.slice(0, 6).map((p) => ({
    value: p.units,
    label: p.name.length > 22 ? `${p.name.slice(0, 22)}…` : p.name,
  }));

  const topByRevenue = [...data.topProducts]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((p) => ({
      value: centsToChartValue(p.revenue),
      label: p.name.length > 22 ? `${p.name.slice(0, 22)}…` : p.name,
    }));

  const statusSlices = data.ordersByStatus.map((s) => ({
    label: ORDER_STATUS_LABEL[s.status],
    value: s.count,
    color: STATUS_COLORS[s.status] ?? ANALYTICS_COLORS.muted,
  }));

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">Analytics</h1>
      <p className="app-subtitle">
        {data.rangeLabel}
        {data.dailyRevenue.length < 14 ? ' · zoomed to days with sales' : ''}
      </p>

      <div className="analytics-actions">
        <button type="button" className="app-btn app-btn--secondary" onClick={() => downloadCsv(data)}>
          Export CSV
        </button>
        <button type="button" className="app-btn app-btn--secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {isApiConfigured && !data.posDataLoaded ? (
        <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
          <p className="app-row-meta" style={{ color: '#92400e' }}>
            Square sales could not be loaded. Check that the backend is running and you are logged in
            as a vendor, then refresh.
          </p>
        </div>
      ) : null}

      <div className="analytics-range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`analytics-chip${range === r ? ' analytics-chip--active' : ''}`}
            onClick={() => setRange(r)}>
            {r === 365 ? '1Y' : `${r}D`}
          </button>
        ))}
      </div>

      <div className="analytics-grid">
        <div className="app-card app-card--honeydew">
          <p className="app-row-meta">Total revenue</p>
          <p className="app-title" style={{ fontSize: '1.35rem', margin: 0 }}>
            {formatPrice(data.totalRevenue)}
          </p>
        </div>
        <div className="app-card">
          <p className="app-row-meta">Units sold</p>
          <p className="app-title" style={{ fontSize: '1.35rem', margin: 0 }}>
            {data.unitsSold}
          </p>
        </div>
        <div className="app-card">
          <p className="app-row-meta">Reservations</p>
          <p className="app-row-title">{formatPrice(data.reservationRevenue)}</p>
        </div>
        <div className="app-card">
          <p className="app-row-meta">In-person</p>
          <p className="app-row-title">{formatPrice(data.inPersonRevenue)}</p>
        </div>
        <div className="app-card">
          <p className="app-row-meta">Card (Square)</p>
          <p className="app-row-title">{formatPrice(data.cardSalesRevenue)}</p>
          <p className="app-row-meta">{data.cardSalesCount} sales</p>
        </div>
      </div>

      <ChartCard
        title="Revenue over time"
        subtitle="Daily total across all channels"
        legend={
          <>
            <LegendRow color={ANALYTICS_COLORS.reservations} label="Reservations" />
            <LegendRow color={ANALYTICS_COLORS.inPerson} label="In-person" />
            <LegendRow color={ANALYTICS_COLORS.cardSales} label="Card (Square)" />
          </>
        }>
        {!hasRevenue ? (
          <EmptyChart message="No revenue in this period yet." />
        ) : (
          <StackedRevenueChart data={data.dailyRevenue} maxValue={maxRevenueCents} />
        )}
      </ChartCard>

      <ChartCard title="Revenue mix" subtitle="By channel">
        {data.revenueBySource.length === 0 ? (
          <EmptyChart message="No revenue yet." />
        ) : (
          <>
            <DonutChart slices={data.revenueBySource} centerLabel={formatPrice(data.totalRevenue)} />
            <div style={{ marginTop: '0.5rem' }}>
              {data.revenueBySource.map((s) => (
                <LegendRow key={s.label} color={s.color} label={s.label} value={formatPrice(s.value)} />
              ))}
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Units sold per day" subtitle="All channels">
        {data.unitsSold === 0 ? (
          <EmptyChart message="No units sold in this period." />
        ) : (
          <VerticalBarChart
            data={data.dailyUnits.map((d) => ({ label: d.label, value: d.units }))}
            color={ANALYTICS_COLORS.units}
            maxValue={maxUnits}
          />
        )}
      </ChartCard>

      <ChartCard title="Top items by units" subtitle="Best sellers in this period">
        {topByUnits.length === 0 ? (
          <EmptyChart message="No item sales yet." />
        ) : (
          <HorizontalBarChart
            data={topByUnits}
            color={ANALYTICS_COLORS.reservations}
            formatValue={(v) => `${v} units`}
          />
        )}
      </ChartCard>

      <ChartCard title="Top items by revenue" subtitle="Highest earning products">
        {topByRevenue.length === 0 ? (
          <EmptyChart message="No item revenue yet." />
        ) : (
          <HorizontalBarChart
            data={topByRevenue}
            color={ANALYTICS_COLORS.inPerson}
            formatValue={(v) => `$${v.toFixed(2)}`}
          />
        )}
      </ChartCard>

      <ChartCard title="Orders by status" subtitle="Reservation pipeline in this period">
        {statusSlices.length === 0 ? (
          <EmptyChart message="No orders in this period." />
        ) : (
          <>
            <DonutChart
              slices={statusSlices}
              centerLabel={`${data.ordersByStatus.reduce((s, x) => s + x.count, 0)}`}
            />
            <PieLegend slices={statusSlices} />
          </>
        )}
      </ChartCard>

      {data.topProducts.length > 0 ? (
        <ChartCard title="Item breakdown" subtitle="Units and revenue by product">
          <div className="app-list">
            {data.topProducts.map((p) => (
              <div key={p.name} className="app-row">
                <div>
                  <p className="app-row-title">{p.name}</p>
                  <p className="app-row-meta">{p.units} units</p>
                </div>
                <p className="app-row-title">{formatPrice(p.revenue)}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      ) : null}

      {data.recentPosSales.length > 0 ? (
        <ChartCard title="Recent card sales" subtitle="Latest Square transactions">
          <div className="app-list">
            {data.recentPosSales.map((txn) => (
              <div key={txn.id} className="app-row">
                <div>
                  <p className="app-row-title">{formatPrice(txn.netAmount)}</p>
                  <p className="app-row-meta">
                    {formatDateTime(txn.soldAt)} · {formatTender(txn)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
