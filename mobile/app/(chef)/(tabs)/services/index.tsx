import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { ServiceCard } from '@/src/components/chef/service-card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { ChefService } from '@/src/types/database';

export default function ChefServicesScreen() {
  const { chef } = useAuth();
  const [services, setServices] = useState<ChefService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!chef?.id) {
      setServices([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('chef_services')
      .select('*')
      .eq('chef_id', chef.id)
      .order('created_at', { ascending: false });

    setServices((data ?? []) as ChefService[]);
    setLoading(false);
  }, [chef?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="mb-4">
            <Text variant="title" className="mb-2">
              Your services
            </Text>
            <PressableCard onPress={() => router.push('/(chef)/services/create')}>
              <Text variant="heading">+ New service</Text>
            </PressableCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingIndicator />
          ) : (
            <Text variant="caption">No services yet. Add your first offering.</Text>
          )
        }
        renderItem={({ item }) => (
          <ServiceCard
            service={item}
            onPress={() => router.push(`/(chef)/services/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
