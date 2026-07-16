import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';

import { Logo } from '@/src/components/Logo';
import { RootedTabBar } from '@/src/components/navigation/rooted-tab-bar';
import {
  rootedTabScreenOptions,
  screenHeaderTitleStyle,
} from '@/src/components/navigation/rooted-tab-options';
import { colors } from '@/src/theme/colors';

function TabIcon({
  name,
  color,
  size = 24,
  focused = false,
}: {
  name: ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
  focused?: boolean;
}) {
  return <FontAwesome size={focused ? size + 2 : size} name={name} color={color} />;
}

function ScreenTitle({ children }: { children: string }) {
  return <Text style={screenHeaderTitleStyle}>{children}</Text>;
}

function CreatorModeButton() {
  return (
    <Link href="/creator" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch to Creator Mode"
        style={{
          marginRight: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
          backgroundColor: colors.primary,
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>
          🔄 Creator
        </Text>
      </Pressable>
    </Link>
  );
}

export default function ShopperTabsLayout() {
  return (
    <Tabs tabBar={(props) => <RootedTabBar {...props} />} screenOptions={rootedTabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          headerTitle: () => <Logo size="small" />,
          headerTitleAlign: 'center',
          headerRight: () => <CreatorModeButton />,
          // Farmers-market map + list (all public market events)
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="map-marker" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          headerTitle: () => <ScreenTitle>Inbox</ScreenTitle>,
          headerTitleAlign: 'left',
          headerRight: () => <CreatorModeButton />,
          lazy: true,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="comments" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerTitle: () => <ScreenTitle>Orders</ScreenTitle>,
          headerTitleAlign: 'left',
          headerRight: () => <CreatorModeButton />,
          lazy: true,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="shopping-bag" color={color} size={size} focused={focused} />
          ),
        }}
      />

      {/* Legacy tabs — hidden from the bar, still deep-linkable */}
      <Tabs.Screen name="home" options={{ href: null, lazy: true }} />
      <Tabs.Screen name="search" options={{ href: null, lazy: true }} />
      <Tabs.Screen name="events" options={{ href: null, lazy: true }} />
      <Tabs.Screen name="profile" options={{ href: null, lazy: true }} />
      <Tabs.Screen name="explore" options={{ href: null, lazy: true }} />
      <Tabs.Screen name="map" options={{ href: null, headerShown: false, lazy: true }} />
      <Tabs.Screen name="feed" options={{ href: null, lazy: true }} />
    </Tabs>
  );
}
