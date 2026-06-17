import { Stack, useFocusEffect } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { isApiConfigured } from '@/src/lib/api';
import { posApi } from '@/src/lib/pos-api';
import { supabase } from '@/src/lib/supabase';
import type { PosProductMapping } from '@/src/types/pos';

interface ProductOption {
  id: string;
  name: string;
}

export default function PosMappingsScreen() {
  const { vendor } = useAuth();
  const [mappings, setMappings] = useState<PosProductMapping[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured || !vendor) {
      setLoading(false);
      return;
    }
    try {
      const [maps, productsRes] = await Promise.all([
        posApi.listMappings(),
        supabase.from('products').select('id, name').eq('vendor_id', vendor.id),
      ]);
      setMappings(maps);
      setProducts((productsRes.data as ProductOption[]) ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function assign(
    mapping: PosProductMapping,
    change: { productId?: string | null; ignored?: boolean },
  ) {
    setSaving(true);
    setError(null);
    try {
      await posApi.upsertMapping({
        connectionId: mapping.connectionId,
        providerCatalogObjectId: mapping.providerCatalogObjectId,
        ...change,
      });
      setSelected(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function productName(productId?: string | null): string | null {
    if (!productId) return null;
    return products.find((p) => p.id === productId)?.name ?? 'Mapped product';
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Item mappings',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : mappings.length === 0 ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            No register items yet.
          </Text>
          <Text variant="caption" className="mt-2 text-center">
            Run a sync first — imported items will appear here to match.
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <Text variant="subtitle" className="mb-4">
            Match each register item to a Rooted product so sales roll into the right analytics.
          </Text>

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          <View className="gap-2">
            {mappings.map((m) => {
              const mapped = productName(m.productId);
              const isOpen = selected === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setSelected(isOpen ? null : m.id)}
                  disabled={saving}>
                  <Card className={isOpen ? 'border-2 border-primary' : ''}>
                    <View className="flex-row items-center justify-between">
                      <Text variant="body" className="flex-1 pr-3 font-semibold">
                        {m.providerItemName ?? m.providerCatalogObjectId}
                      </Text>
                      <Text
                        variant="caption"
                        className={m.ignored ? 'text-gray-400' : mapped ? 'text-forest' : 'text-amber-700'}>
                        {m.ignored ? 'Ignored' : (mapped ?? 'Unmatched')}
                      </Text>
                    </View>

                    {isOpen ? (
                      <View className="mt-3">
                        <Text className="mb-1.5 text-sm font-semibold text-ink">
                          Assign to product
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerClassName="gap-2">
                          {products.map((p) => (
                            <Chip
                              key={p.id}
                              label={p.name}
                              selected={m.productId === p.id}
                              onPress={() => assign(m, { productId: p.id, ignored: false })}
                            />
                          ))}
                        </ScrollView>
                        <View className="mt-3 flex-row gap-2">
                          <Chip
                            label="Ignore item"
                            selected={m.ignored}
                            onPress={() => assign(m, { ignored: true, productId: null })}
                          />
                          {m.productId || m.ignored ? (
                            <Chip
                              label="Clear"
                              selected={false}
                              onPress={() => assign(m, { productId: null, ignored: false })}
                            />
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </Screen>
      )}
    </>
  );
}
