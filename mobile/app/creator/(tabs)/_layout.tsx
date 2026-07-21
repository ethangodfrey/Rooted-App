import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';

import { RootedTabBar } from '@/src/components/navigation/rooted-tab-bar';
import { rootedTabScreenOptions } from '@/src/components/navigation/rooted-tab-options';
import { colors } from '@/src/theme/colors';

function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
}) {
  return <FontAwesome size={size} name={name} color={color} />;
}

function BackToShoppingButton() {
  return (
    <Link href="/(shopper)/(tabs)/" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Shopping"
        style={{
          marginRight: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
          backgroundColor: colors.primary,
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>
          🔄 Shopping
        </Text>
      </Pressable>
    </Link>
  );
}

export default function CreatorTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RootedTabBar {...props} />}
      screenOptions={{
        ...rootedTabScreenOptions,
        headerRight: () => <BackToShoppingButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, size }) => <TabIcon name="tags" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="handoffs"
        options={{
          title: 'Hand-offs',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="exchange" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="cog" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
