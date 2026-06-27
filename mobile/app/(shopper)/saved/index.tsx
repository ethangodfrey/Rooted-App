import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useSavedItems } from '@/src/hooks/use-saved-items';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { SavedItemType } from '@/src/types/database';

interface SavedRow {
  id: string;
  itemType: SavedItemType;
  title: string;
  subtitle: string | null;
  href: string;
}

const TYPE_LABELS: Record<SavedItemType, string> = {
  vendor: 'Vendors',
  chef: 'Chefs',
  product: 'Products',
  service: 'Services',
  event: 'Events',
};

export default function SavedItemsScreen() {
  const { items, loaded, refresh } = useSavedItems();
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    if (items.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const vendorIds = items.filter((row) => row.item_type === 'vendor').map((row) => row.vendor_id!);
    const chefIds = items.filter((row) => row.item_type === 'chef').map((row) => row.chef_id!);
    const productIds = items
      .filter((row) => row.item_type === 'product')
      .map((row) => row.product_id!);
    const serviceIds = items
      .filter((row) => row.item_type === 'service')
      .map((row) => row.service_id!);
    const eventIds = items.filter((row) => row.item_type === 'event').map((row) => row.event_id!);

    const [vendorsRes, chefsRes, productsRes, servicesRes, eventsRes] = await Promise.all([
      vendorIds.length
        ? supabase.from('vendors').select('id, business_name, category').in('id', vendorIds)
        : Promise.resolve({ data: [] }),
      chefIds.length
        ? supabase.from('chefs').select('id, display_name, home_base_city, home_base_state').in('id', chefIds)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? supabase.from('products').select('id, name, category').in('id', productIds)
        : Promise.resolve({ data: [] }),
      serviceIds.length
        ? supabase.from('chef_services').select('id, service_name, service_type').in('id', serviceIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase.from('events').select('id, name, city, state').in('id', eventIds)
        : Promise.resolve({ data: [] }),
    ]);

    const vendorMap = new Map((vendorsRes.data ?? []).map((row) => [row.id, row]));
    const chefMap = new Map((chefsRes.data ?? []).map((row) => [row.id, row]));
    const productMap = new Map((productsRes.data ?? []).map((row) => [row.id, row]));
    const serviceMap = new Map((servicesRes.data ?? []).map((row) => [row.id, row]));
    const eventMap = new Map((eventsRes.data ?? []).map((row) => [row.id, row]));

    const nextRows: SavedRow[] = [];

    for (const item of items) {
      if (item.item_type === 'vendor' && item.vendor_id) {
        const vendor = vendorMap.get(item.vendor_id);
        nextRows.push({
          id: item.id,
          itemType: 'vendor',
          title: vendor?.business_name ?? 'Vendor',
          subtitle: vendor?.category ?? null,
          href: `/(shopper)/vendors/${item.vendor_id}`,
        });
      } else if (item.item_type === 'chef' && item.chef_id) {
        const chef = chefMap.get(item.chef_id);
        nextRows.push({
          id: item.id,
          itemType: 'chef',
          title: chef?.display_name ?? 'Chef',
          subtitle: chef?.home_base_city
            ? `${chef.home_base_city}, ${chef.home_base_state ?? ''}`.trim()
            : null,
          href: `/(shopper)/chefs/${item.chef_id}`,
        });
      } else if (item.item_type === 'product' && item.product_id) {
        const product = productMap.get(item.product_id);
        nextRows.push({
          id: item.id,
          itemType: 'product',
          title: product?.name ?? 'Product',
          subtitle: product?.category ?? null,
          href: `/(shopper)/products/${item.product_id}`,
        });
      } else if (item.item_type === 'service' && item.service_id) {
        const service = serviceMap.get(item.service_id);
        nextRows.push({
          id: item.id,
          itemType: 'service',
          title: service?.service_name ?? 'Service',
          subtitle: service?.service_type?.replace(/_/g, ' ') ?? null,
          href: `/(shopper)/chefs/book/${item.service_id}`,
        });
      } else if (item.item_type === 'event' && item.event_id) {
        const event = eventMap.get(item.event_id);
        nextRows.push({
          id: item.id,
          itemType: 'event',
          title: event?.name ?? 'Event',
          subtitle: event?.city ? `${event.city}, ${event.state ?? ''}`.trim() : null,
          href: `/(shopper)/events/${item.event_id}`,
        });
      }
    }

    setRows(nextRows);
    setLoading(false);
  }, [items]);

  useEffect(() => {
    if (!loaded) return;
    void loadDetails();
  }, [loaded, loadDetails]);

  const grouped = rows.reduce<Partial<Record<SavedItemType, SavedRow[]>>>((acc, row) => {
    acc[row.itemType] = [...(acc[row.itemType] ?? []), row];
    return acc;
  }, {});

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Saved',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        {!loaded || loading ? (
          <LoadingIndicator />
        ) : rows.length === 0 ? (
          <Text variant="caption">
            Tap the heart on vendors, chefs, and other listings to save them here.
          </Text>
        ) : (
          (Object.keys(TYPE_LABELS) as SavedItemType[]).map((type) => {
            const section = grouped[type];
            if (!section?.length) return null;
            return (
              <View key={type} className="mb-6">
                <Text variant="heading" className="mb-3">
                  {TYPE_LABELS[type]}
                </Text>
                <View className="gap-3">
                  {section.map((row) => (
                    <Pressable key={row.id} onPress={() => router.push(row.href as never)}>
                      <Card className="flex-row items-center px-4 py-3.5">
                        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
                          <FontAwesome name="heart" size={16} color={colors.primary} />
                        </View>
                        <View className="min-w-0 flex-1 pr-2">
                          <Text variant="body" className="font-semibold">
                            {row.title}
                          </Text>
                          {row.subtitle ? (
                            <Text variant="caption" className="mt-0.5">
                              {row.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        )}
        <Pressable onPress={() => refresh()} className="mt-2">
          <Text className="text-center text-sm font-medium text-primary">Refresh</Text>
        </Pressable>
      </Screen>
    </>
  );
}
