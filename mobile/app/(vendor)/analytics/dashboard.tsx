import { Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';

import { ChartCard, LegendRow } from '@/src/components/analytics/chart-card';
import {
  DonutChart,
  HorizontalBarChart,
  MultiLineChart,
  PieChartView,
  SingleLineChart,
  VerticalBarChart,
} from '@/src/components/analytics/simple-charts';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { isApiConfigured } from '@/src/lib/api';
import { formatPrice } from '@/src/lib/format';
import { ORDER_STATUS_LABEL } from '@/src/lib/order-status';
import { triggerStalePosSync } from '@/src/lib/pos-sync';
import {
  ANALYTICS_COLORS,
  centsToChartValue,
  loadVendorAnalytics,
  maxChartValue,
  type AnalyticsRange,
  type VendorAnalyticsData,
} from '@/src/lib/vendor-analytics';

const RANGES: AnalyticsRange[] = [7, 30, 90, 365];

const STATUS_COLORS: Record<string, string> = {
  submitted: '#50C878',
  pending_review: '#52b788',
  accepted: '#228B22',
  preparing: '#74c69d',
  ready_for_pickup: '#95d5b2',
  fulfilled: '#228B22',
  declined: '#d97706',
  cancelled: '#b91c1c',
};

function EmptyChart({ message }: { message: string }) {
  return (
    <View className="items-center justify-center rounded-xl bg-stone-50 py-10">
      <Text variant="caption">{message}</Text>
    </View>
  );
}

export default function AnalyticsDashboardScreen() {
  const { vendor } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<VendorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const chartWidth = Dimensions.get('window').width - 64;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;

      async function loadMetrics() {
        if (!vendor) return;
        const result = await loadVendorAnalytics(vendor.id, range);
        if (active) setData(result);
      }

      async function load() {
        if (!vendor) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const triggered = await triggerStalePosSync();
          await loadMetrics();
          if (triggered) {
            refreshTimer = setTimeout(() => {
              if (active) void loadMetrics();
            }, 2500);
          }
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => {
        active = false;
        if (refreshTimer) clearTimeout(refreshTimer);
      };
    }, [vendor, range]),
  );

  const maxRevenue = maxChartValue(
    data?.dailyRevenue.map((d) => centsToChartValue(d.total)) ?? [],
  );
  const maxUnits = maxChartValue(data?.dailyUnits.map((d) => d.units) ?? [], 1);

  const revenueDataSet = data
    ? [
        {
          data: data.dailyRevenue.map((d) => ({
            value: centsToChartValue(d.reservations),
            label: d.label,
          })),
          color: ANALYTICS_COLORS.reservations,
        },
        {
          data: data.dailyRevenue.map((d) => ({
            value: centsToChartValue(d.inPerson),
            label: d.label,
          })),
          color: ANALYTICS_COLORS.inPerson,
        },
        {
          data: data.dailyRevenue.map((d) => ({
            value: centsToChartValue(d.cardSales),
            label: d.label,
          })),
          color: ANALYTICS_COLORS.cardSales,
        },
      ]
    : [];

  const revenueLineData =
    data?.dailyRevenue.map((d) => ({
      value: centsToChartValue(d.total),
      label: d.label,
    })) ?? [];

  const unitsBarData =
    data?.dailyUnits.map((d) => ({
      value: d.units,
      label: d.label,
    })) ?? [];

  const topByUnits =
    data?.topProducts.slice(0, 6).map((p) => ({
      value: p.units,
      label: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
    })) ?? [];

  const topByRevenue =
    data?.topProducts
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((p) => ({
        value: centsToChartValue(p.revenue),
        label: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
      })) ?? [];

  const sourcePie =
    data?.revenueBySource.map((s) => ({
      value: centsToChartValue(s.value),
      color: s.color,
      label: s.label,
    })) ?? [];

  const statusPie =
    data?.ordersByStatus.map((s) => ({
      value: s.count,
      color: STATUS_COLORS[s.status] ?? ANALYTICS_COLORS.muted,
      label: ORDER_STATUS_LABEL[s.status],
    })) ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Analytics dashboard',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading || !data ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : (
        <Screen scroll>
          <Text variant="caption" className="mb-3">
            {data.rangeLabel}
            {data.dailyRevenue.length < 14 ? ' · zoomed to days with sales' : ''}
          </Text>

          {isApiConfigured && !data.posDataLoaded ? (
            <Card className="mb-4 bg-honeydew">
              <Text variant="caption" className="text-amber-900">
                Square sales could not be loaded. Check that the backend is running and you are
                logged in as a vendor, then pull to refresh.
              </Text>
            </Card>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}>
            {RANGES.map((r) => (
              <Chip
                key={r}
                label={r === 365 ? '1Y' : `${r}D`}
                selected={range === r}
                onPress={() => setRange(r)}
              />
            ))}
          </ScrollView>

          <View className="mb-4 flex-row flex-wrap gap-3">
            <Card className="min-w-[46%] flex-1 bg-honeydew">
              <Text variant="caption">Total revenue</Text>
              <Text variant="heading" className="mb-0">
                {formatPrice(data.totalRevenue)}
              </Text>
            </Card>
            <Card className="min-w-[46%] flex-1">
              <Text variant="caption">Units sold</Text>
              <Text variant="heading" className="mb-0">
                {data.unitsSold}
              </Text>
            </Card>
            <Card className="min-w-[46%] flex-1">
              <Text variant="caption">Reservations</Text>
              <Text variant="body" className="font-semibold">
                {formatPrice(data.reservationRevenue)}
              </Text>
            </Card>
            <Card className="min-w-[46%] flex-1">
              <Text variant="caption">In-person</Text>
              <Text variant="body" className="font-semibold">
                {formatPrice(data.inPersonRevenue)}
              </Text>
            </Card>
            <Card className="min-w-[46%] flex-1">
              <Text variant="caption">Card (Square)</Text>
              <Text variant="body" className="font-semibold">
                {formatPrice(data.cardSalesRevenue)}
              </Text>
              <Text variant="caption">{data.cardSalesCount} sales</Text>
            </Card>
          </View>

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
            {data.cardSalesRevenue === 0 &&
            data.reservationRevenue === 0 &&
            data.inPersonRevenue === 0 ? (
              <EmptyChart message="No revenue in this period yet." />
            ) : (
              <MultiLineChart
                series={revenueDataSet}
                height={220}
                minWidth={chartWidth}
                maxValue={maxChartValue(
                  data.dailyRevenue.flatMap((d) => [
                    centsToChartValue(d.reservations),
                    centsToChartValue(d.inPerson),
                    centsToChartValue(d.cardSales),
                  ]),
                )}
              />
            )}
          </ChartCard>

          <ChartCard title="Total revenue trend" subtitle="Combined daily revenue">
            {data.cardSalesRevenue === 0 &&
            data.reservationRevenue === 0 &&
            data.inPersonRevenue === 0 ? (
              <EmptyChart message="No revenue in this period yet." />
            ) : (
              <SingleLineChart
                data={revenueLineData}
                color={ANALYTICS_COLORS.reservations}
                height={200}
                minWidth={chartWidth}
                maxValue={maxRevenue}
              />
            )}
          </ChartCard>

          <ChartCard title="Revenue mix" subtitle="By channel">
            {sourcePie.length === 0 ? (
              <EmptyChart message="No revenue yet." />
            ) : (
              <View className="items-center py-2">
                <DonutChart
                  slices={sourcePie}
                  size={160}
                  centerLabel={formatPrice(data.totalRevenue)}
                />
              </View>
            )}
          </ChartCard>

          {sourcePie.length > 0 ? (
            <Card className="mb-4">
              {data.revenueBySource.map((s) => (
                <LegendRow
                  key={s.label}
                  color={s.color}
                  label={s.label}
                  value={formatPrice(s.value)}
                />
              ))}
            </Card>
          ) : null}

          <ChartCard title="Units sold per day" subtitle="All channels">
            {data.unitsSold === 0 ? (
              <EmptyChart message="No units sold in this period." />
            ) : (
              <VerticalBarChart
                data={unitsBarData}
                color={ANALYTICS_COLORS.units}
                height={200}
                minWidth={chartWidth}
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
            {statusPie.length === 0 ? (
              <EmptyChart message="No orders in this period." />
            ) : (
              <>
                <View className="items-center py-2">
                  <PieChartView slices={statusPie} size={160} />
                </View>
                <View className="mt-3">
                  {data.ordersByStatus.map((s) => (
                    <LegendRow
                      key={s.status}
                      color={STATUS_COLORS[s.status] ?? ANALYTICS_COLORS.muted}
                      label={ORDER_STATUS_LABEL[s.status]}
                      value={String(s.count)}
                    />
                  ))}
                </View>
              </>
            )}
          </ChartCard>

          {data.topProducts.length > 0 ? (
            <ChartCard title="Item breakdown" subtitle="Units and revenue by product">
              <View className="gap-2">
                {data.topProducts.map((p) => (
                  <View
                    key={p.name}
                    className="flex-row items-center justify-between border-b border-stone-100 py-2">
                    <Text variant="body" className="flex-1 pr-3" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <View className="items-end">
                      <Text variant="caption" className="font-semibold">
                        {p.units} units
                      </Text>
                      <Text variant="caption">{formatPrice(p.revenue)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ChartCard>
          ) : null}
        </Screen>
      )}
    </>
  );
}
