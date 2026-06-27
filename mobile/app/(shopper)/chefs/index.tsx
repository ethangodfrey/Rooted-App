import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { ChefCard } from '@/src/components/chef/chef-card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { supabase } from '@/src/lib/supabase';
import type { Chef } from '@/src/types/database';

export default function BrowseChefsScreen() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('chefs')
      .select('*')
      .eq('approval_status', 'approved')
      .order('featured', { ascending: false })
      .order('display_name', { ascending: true });

    setChefs((data ?? []) as Chef[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Private chefs',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen>
        <FlatList
          data={chefs}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8 pt-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? <LoadingIndicator /> : <Text variant="caption">No chefs listed yet.</Text>
          }
          renderItem={({ item }) => (
            <ChefCard chef={item} onPress={() => router.push(`/(shopper)/chefs/${item.id}`)} />
          )}
        />
      </Screen>
    </>
  );
}
