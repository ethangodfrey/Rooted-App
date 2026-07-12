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
import { SettlementDashboard } from '@/components/vendor/SettlementDashboard';
import {
  VendorEmpty,
  VendorFormPanel,
  VendorHero,
  VendorKpiGrid,
  VendorKpiStat,
  VendorListPanel,
  VendorScreen,
  VendorSecondaryButton,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { IconBadge } from '@/components/vendor/dashboard-icons';
import '@/components/analytics/analytics.css';
import { useAuth } from '@/hooks/use-auth';
import { usePosLedger } from '@/hooks/use-pos-ledger';
import { useVendorSettlementOrders } from '@/hooks/use-vendor-settlement-orders';
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
import { POS_PROVIDER_LABELS } from '@/types/pos-transactions';
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
  a.download = 'vendorly-analytics.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function VendorAnalyticsPage() {
  const { vendor } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const { hasActiveConnection, liveFeed, loading: posLedgerLoading, error: posLedgerError } = usePosLedger({
    vendorId: vendor?.id,
    range,
  });
  const {
    orders: settlementOrders,
    loading: settlementLoading,
    error: settlementError,
  } = useVendorSettlementOrders(vendor?.id);
  const [data, setData] = useState<VendorAnalyticsData | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const result = await loadVendorAnalytics(vendor.id, range);
    setData(result);
  }, [vendor, range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
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
    <VendorScreen>
      <VendorHero
        eyebrow="Vendor"
        title="Analytics"
        subtitle={`${data.rangeLabel}${data.dailyRevenue.length < 14 ? ' · zoomed to active days' : ''}`}
      />

      <div className="analytics-actions mb-4 flex gap-2">
        <VendorSecondaryButton onClick={() => downloadCsv(data)}>Export CSV</VendorSecondaryButton>
        <VendorSecondaryButton onClick={() => void load()}>Refresh</VendorSecondaryButton>
      </div>

      {isApiConfigured && !data.posDataLoaded && !data.posLedgerLoaded ? (
        <VendorFormPanel className="mb-4">
          <p className="m-0 text-xs text-amber-800">
            POS sales could not be loaded. Check your connection and refresh.
          </p>
        </VendorFormPanel>
      ) : null}

      {!posLedgerLoading && !hasActiveConnection ? (
        <VendorFormPanel className="mb-4">
          <p className="m-0 text-sm text-stone-600">
            Connect a POS provider to unlock live card sales, platform fee splits, and realtime streaming.
          </p>
          <div className="mt-3">
            <VendorSecondaryButton to="/vendor/pos">Connect POS</VendorSecondaryButton>
          </div>
        </VendorFormPanel>
      ) : null}

      {posLedgerError ? (
        <VendorFormPanel className="mb-4">
          <p className="m-0 text-xs text-amber-800">{posLedgerError}</p>
        </VendorFormPanel>
      ) : null}

      <div className="analytics-range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`analytics-chip ${VENDOR_PRESSABLE}${range === r ? ' analytics-chip--active' : ''}`}
            onClick={() => setRange(r)}>
            {r === 365 ? '1Y' : `${r}D`}
          </button>
        ))}
      </div>

      <ChartCard title="Market settlement" subtitle="Fulfilled presale totals">
        <SettlementDashboard
          orders={settlementOrders}
          loading={settlementLoading}
          error={settlementError}
        />
      </ChartCard>

      <VendorKpiGrid cols={3}>
        <VendorKpiStat value={formatPrice(data.totalRevenue)} label="Total revenue" />
        <VendorKpiStat value={data.unitsSold} label="Units sold" />
        <VendorKpiStat value={formatPrice(data.reservationRevenue)} label="Reservations" />
        <VendorKpiStat value={formatPrice(data.inPersonRevenue)} label="In-person" />
        <VendorKpiStat
          value={formatPrice(data.cardSalesRevenue)}
          label={`Card (${data.cardSalesCount})`}
        />
      </VendorKpiGrid>

      {data.posLedgerLoaded ? (
        <ChartCard title="POS fee split" subtitle="Gross, platform fees, and net from pos_transactions">
          {data.posGrossTotal === 0 && data.posNetTotal === 0 ? (
            <VendorEmpty
              message={
                hasActiveConnection
                  ? 'POS connected — waiting for your first card sale to sync.'
                  : 'No POS transactions in this period yet.'
              }
            />
          ) : (
            <VendorKpiGrid cols={3}>
              <VendorKpiStat value={formatPrice(data.posGrossTotal)} label="Gross" />
              <VendorKpiStat value={formatPrice(data.posPlatformFees)} label="Platform fees" />
              <VendorKpiStat value={formatPrice(data.posNetTotal)} label="Net to vendor" />
            </VendorKpiGrid>
          )}
        </ChartCard>
      ) : null}

      <ChartCard title="Revenue over time" subtitle="Daily total by channel">
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

      <ChartCard title="Units sold per day">
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

      <ChartCard title="Top items by units">
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

      <ChartCard title="Top items by revenue">
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

      <ChartCard title="Orders by status" subtitle="Reservation pipeline">
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
        <ChartCard title="Item breakdown">
          <VendorListPanel>
            {data.topProducts.map((p, index) => (
              <div key={`${p.name}-${index}`} className="flex items-center justify-between gap-3 p-3.5">
                <span className="flex min-w-0 items-center gap-3">
                  <IconBadge name="package" tone="orange" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-stone-800">{p.name}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{p.units} units</span>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-stone-700">{formatPrice(p.revenue)}</span>
              </div>
            ))}
          </VendorListPanel>
        </ChartCard>
      ) : null}

      {liveFeed.length > 0 ? (
        <ChartCard title="Live POS stream" subtitle="Realtime sales from webhooks">
          <VendorListPanel>
            {liveFeed.map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 p-3.5">
                <IconBadge name="credit-card" tone="amber" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-stone-800">
                    {formatPrice(txn.net_amount)}
                    <span className="ml-2 text-xs font-normal text-stone-500">
                      gross {formatPrice(txn.gross_amount)} · fee {formatPrice(txn.platform_fee)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {formatDateTime(txn.sold_at)} · {POS_PROVIDER_LABELS[txn.provider]}
                  </span>
                </span>
              </div>
            ))}
          </VendorListPanel>
        </ChartCard>
      ) : hasActiveConnection && !posLedgerLoading ? (
        <ChartCard title="Live POS stream">
          <VendorEmpty message="Connected — sales will appear here as webhooks arrive." />
        </ChartCard>
      ) : null}

      {data.recentPosSales.length > 0 ? (
        <ChartCard title="Recent card sales">
          <VendorListPanel>
            {data.recentPosSales.map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 p-3.5">
                <IconBadge name="credit-card" tone="amber" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800">{formatPrice(txn.netAmount)}</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {formatDateTime(txn.soldAt)} · {formatTender(txn)}
                  </span>
                </span>
              </div>
            ))}
          </VendorListPanel>
        </ChartCard>
      ) : null}
    </VendorScreen>
  );
}
