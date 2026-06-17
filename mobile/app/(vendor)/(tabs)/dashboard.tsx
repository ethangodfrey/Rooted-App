import { FontAwesome } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Card, PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

const statusCopy: Record<string, string> = {
  pending: 'Your vendor account is pending admin approval.',
  approved: 'Your storefront is live and visible to shoppers.',
  rejected: 'Your vendor application was not approved. Contact support.',
};

export default function VendorDashboardScreen() {
  const { user, vendor } = useAuth();
  const status = vendor?.approval_status ?? 'pending';
  const [pendingOrders, setPendingOrders] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!vendor) return;
        const [ordersRes, productsRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', vendor.id)
            .in('order_status', ['submitted', 'pending_review']),
          supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', vendor.id)
            .eq('status', 'active'),
        ]);
        if (!active) return;
        setPendingOrders(ordersRes.count ?? 0);
        setActiveProducts(productsRes.count ?? 0);
      }
      load();
      return () => {
        active = false;
      };
    }, [vendor]),
  );

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Vendor
      </Text>
      <Text variant="title" className="mb-1">
        Dashboard
      </Text>
      <Text variant="subtitle" className="mb-6">
        {user?.email ? `Signed in as ${user.email}` : 'Your operations hub.'}
      </Text>

      <Card className="mb-4 bg-honeydew">
        <Text variant="caption" className="mb-1">
          Approval status
        </Text>
        <Text variant="heading" className="mb-1 capitalize">
          {status}
        </Text>
        <Text variant="caption">{statusCopy[status]}</Text>
      </Card>

      <View className="mb-4 flex-row gap-4">
        <PressableCard className="flex-1" onPress={() => router.push('/(vendor)/(tabs)/orders')}>
          <Text variant="title" className="mb-0">
            {pendingOrders}
          </Text>
          <Text variant="caption">Pending orders</Text>
        </PressableCard>
        <PressableCard className="flex-1" onPress={() => router.push('/(vendor)/(tabs)/products')}>
          <Text variant="title" className="mb-0">
            {activeProducts}
          </Text>
          <Text variant="caption">Active products</Text>
        </PressableCard>
      </View>

      <View className="gap-3">
        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(vendor)/analytics')}>
          <View className="flex-1 pr-3">
            <Text variant="heading" className="mb-1">
              Analytics
            </Text>
            <Text variant="caption">Summary, charts, revenue trends, and top items.</Text>
          </View>
          <FontAwesome name="bar-chart" size={16} color="#9CAF88" />
        </PressableCard>

        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(vendor)/pos')}>
          <View className="flex-1 pr-3">
            <Text variant="heading" className="mb-1">
              Point of sale
            </Text>
            <Text variant="caption">Connect Square to import card sales automatically.</Text>
          </View>
          <FontAwesome name="credit-card" size={16} color="#9CAF88" />
        </PressableCard>

        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(vendor)/sales/manual')}>
          <View className="flex-1 pr-3">
            <Text variant="heading" className="mb-1">
              Log in-person sale
            </Text>
            <Text variant="caption">Record a booth or cash sale to keep totals accurate.</Text>
          </View>
          <FontAwesome name="plus-circle" size={16} color="#9CAF88" />
        </PressableCard>

        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(vendor)/leftovers')}>
          <View className="flex-1 pr-3">
            <Text variant="heading" className="mb-1">
              List leftovers
            </Text>
            <Text variant="caption">
              Post unsold items after market with expiry and pickup location.
            </Text>
          </View>
          <FontAwesome name="recycle" size={16} color="#9CAF88" />
        </PressableCard>

        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(vendor)/events')}>
          <View className="flex-1 pr-3">
            <Text variant="heading" className="mb-1">
              Event participation
            </Text>
            <Text variant="caption">Join upcoming events so shoppers can find you.</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#9CAF88" />
        </PressableCard>
      </View>
    </Screen>
  );
}
