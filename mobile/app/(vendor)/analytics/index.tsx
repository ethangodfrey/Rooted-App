import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { isApiConfigured } from '@/src/lib/api';
import { formatDateTime, formatPrice } from '@/src/lib/format';
import { ORDER_STATUS_LABEL } from '@/src/lib/order-status';
import { refreshPosSyncState, type PosSyncStatus } from '@/src/lib/pos-sync';
import { loadVendorAnalytics, type VendorAnalyticsData } from '@/src/lib/vendor-analytics';
import type { PosImportedTransaction } from '@/src/types/pos';

function formatTender(txn: PosImportedTransaction): string {
  if (txn.cardBrand) return txn.cardBrand;
  if (txn.tenderType) return txn.tenderType.replace(/_/g, ' ').toLowerCase();
  return 'Card';
}

export default function VendorAnalyticsScreen() {
  const { vendor } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<VendorAnalyticsData | null>(null);
  const [posSync, setPosSync] = useState<PosSyncStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;

      async function load() {
        if (!vendor) return;

        const metricsPromise = loadVendorAnalytics(vendor.id, 90);

        void refreshPosSyncState().then(({ syncStatus, triggered }) => {
          if (!active) return;
          setPosSync(syncStatus);
          if (triggered) {
            refreshTimer = setTimeout(() => {
              if (active) {
                void loadVendorAnalytics(vendor.id, 90, { force: true }).then((data) => {
                  if (active) setMetrics(data);
                });
              }
            }, 2500);
          }
        });

        try {
          const data = await metricsPromise;
          if (active) setMetrics(data);
        } catch {
          // keep prior metrics visible on refresh failure
        }
      }
      load();
      return () => {
        active = false;
        if (refreshTimer) clearTimeout(refreshTimer);
      };
    }, [vendor]),
  );

  async function exportCsv() {
    if (!metrics) return;
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
      lines.push(
        `${p.name.replace(/,/g, ' ')},${p.units},${(p.revenue / 100).toFixed(2)}`,
      );
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
    await Share.share({ message: lines.join('\n'), title: 'Vendorly analytics export' });
  }

  const totalRevenue = metrics?.totalRevenue ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Analytics',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {!metrics ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : (
        <Screen scroll>
          {posSync ? (
            <Card className="mb-4 bg-honeydew">
              <Text variant="caption" className="mb-1 font-semibold text-forest-800">
                Square auto-sync
              </Text>
              <Text variant="caption">
                Syncs {posSync.autoSyncLabel}
                {posSync.realTimeEnabled ? ' · real-time webhooks on' : ''}. Last synced{' '}
                {posSync.lastSyncedLabel}.
              </Text>
            </Card>
          ) : null}

          <PressableCard
            className="mb-4 bg-honeydew"
            onPress={() => router.push('/(vendor)/analytics/dashboard')}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text variant="heading" className="mb-1">
                  Full analytics dashboard
                </Text>
                <Text variant="caption">
                  Charts for revenue over time, items sold, order status, and date ranges.
                </Text>
              </View>
              <FontAwesome name="line-chart" size={22} color="#228B22" />
            </View>
          </PressableCard>

          <Card className="mb-4 bg-honeydew">
            <Text variant="caption" className="mb-1">
              Total revenue · {metrics.rangeLabel}
            </Text>
            <Text variant="title" className="mb-3">
              {formatPrice(totalRevenue)}
            </Text>
            <View className="gap-1.5 border-t border-honeydew pt-3">
              <View className="flex-row items-center justify-between">
                <Text variant="caption">Reservations</Text>
                <Text variant="caption" className="font-semibold text-forest-800">
                  {formatPrice(metrics.reservationRevenue)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="caption">In-person</Text>
                <Text variant="caption" className="font-semibold text-forest-800">
                  {formatPrice(metrics.inPersonRevenue)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="caption">Card sales (Square)</Text>
                <Text variant="caption" className="font-semibold text-forest-800">
                  {formatPrice(metrics.cardSalesRevenue)}
                  {metrics.cardSalesCount > 0 ? ` · ${metrics.cardSalesCount}` : ''}
                </Text>
              </View>
            </View>
          </Card>

          {isApiConfigured && metrics.cardSalesCount > 0 ? (
            <View className="mb-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="heading">Square card sales</Text>
                <Pressable
                  onPress={() => router.push('/(vendor)/pos')}
                  className="flex-row items-center">
                  <Text variant="caption" className="mr-1 text-forest-600">
                    POS settings
                  </Text>
                  <FontAwesome name="chevron-right" size={10} color="#228B22" />
                </Pressable>
              </View>

              <View className="gap-3">
                {metrics.recentPosSales.map((txn) => (
                  <Card key={txn.id}>
                    <View className="mb-3 flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text variant="body" className="font-semibold">
                          {formatPrice(txn.netAmount)}
                        </Text>
                        <Text variant="caption">{formatDateTime(txn.soldAt)}</Text>
                      </View>
                      <View className="rounded-full bg-forest-50 px-2.5 py-1">
                        <Text variant="caption" className="text-forest-700">
                          {formatTender(txn)}
                        </Text>
                      </View>
                    </View>

                    {(txn.lineItems ?? []).length > 0 ? (
                      <View className="gap-2 border-t border-stone-100 pt-3">
                        {(txn.lineItems ?? []).map((li) => {
                          const mapped = Boolean(li.productId && li.product?.name);
                          return (
                            <View
                              key={li.id}
                              className="flex-row items-center justify-between gap-2">
                              <View className="min-w-0 flex-1">
                                <Text variant="body" numberOfLines={1}>
                                  {li.name}
                                  {li.quantity > 1 ? ` × ${li.quantity}` : ''}
                                </Text>
                                {mapped ? (
                                  <Text variant="caption" className="text-forest-600">
                                    → {li.product!.name}
                                  </Text>
                                ) : li.itemType === 'CUSTOM_AMOUNT' ? (
                                  <Text variant="caption" className="text-stone-500">
                                    Custom Square charge — use catalog items to track by product
                                  </Text>
                                ) : (
                                  <Text variant="caption" className="text-amber-700">
                                    Not linked to a Vendorly product
                                  </Text>
                                )}
                              </View>
                              <Text variant="caption">{formatPrice(li.grossAmount)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text variant="caption" className="border-t border-stone-100 pt-3">
                        No line items on this sale
                      </Text>
                    )}
                  </Card>
                ))}
              </View>

              {metrics.unmappedPosLineItems > 0 ? (
                <Pressable
                  onPress={() => router.push('/(vendor)/pos/mappings')}
                  className="mt-3">
                  <Card className="flex-row items-center bg-honeydew">
                    <FontAwesome name="link" size={14} color="#b45309" />
                    <View className="ml-3 flex-1">
                      <Text variant="body" className="font-semibold text-amber-900">
                        {metrics.unmappedPosLineItems} register{' '}
                        {metrics.unmappedPosLineItems === 1 ? 'item needs' : 'items need'}{' '}
                        mapping
                      </Text>
                      <Text variant="caption" className="text-amber-800">
                        Link Square items to Vendorly products for inventory tracking
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={12} color="#b45309" />
                  </Card>
                </Pressable>
              ) : null}
            </View>
          ) : isApiConfigured ? (
            <Card className="mb-6 border-dashed">
              <Text variant="body" className="mb-1 font-semibold">
                No Square sales yet
              </Text>
              <Text variant="caption" className="mb-3">
                Card sales from your connected register will appear here after sync.
              </Text>
              <Button
                label="Open POS integrations"
                variant="secondary"
                onPress={() => router.push('/(vendor)/pos')}
              />
            </Card>
          ) : null}

          <Card className="mb-6">
            <Text variant="title" className="mb-0">
              {metrics.unitsSold}
            </Text>
            <Text variant="caption">Total units sold</Text>
          </Card>

          <Text variant="heading" className="mb-3">
            Orders by status
          </Text>
          {metrics.ordersByStatus.length === 0 ? (
            <Text variant="caption" className="mb-6">
              No orders yet.
            </Text>
          ) : (
            <View className="mb-6 gap-2">
              {metrics.ordersByStatus.map((s) => (
                <Card key={s.status} className="flex-row items-center justify-between">
                  <StatusPill status={s.status} />
                  <Text variant="body" className="font-semibold">
                    {s.count}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          <Text variant="heading" className="mb-3">
            Top products
          </Text>
          {metrics.topProducts.length === 0 ? (
            <Text variant="caption" className="mb-6">
              No sales recorded yet.
            </Text>
          ) : (
            <View className="mb-6 gap-2">
              {metrics.topProducts.slice(0, 5).map((p) => (
                <Card key={p.name} className="flex-row items-center justify-between">
                  <Text variant="body" className="flex-1 pr-3">
                    {p.name}
                  </Text>
                  <Text variant="caption">
                    {p.units} sold · {formatPrice(p.revenue)}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          <Button label="Export CSV" variant="secondary" onPress={exportCsv} />
          <View className="mt-3 flex-row items-center justify-center">
            <FontAwesome name="info-circle" size={12} color="#9CAF88" />
            <Text variant="caption" className="ml-1.5">
              Revenue counts fulfilled reservations + in-person sales + Square card sales.
            </Text>
          </View>
        </Screen>
      )}
    </>
  );
}
