import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { RootedTabBar } from '@/src/components/navigation/rooted-tab-bar';
import { rootedTabScreenOptions } from '@/src/components/navigation/rooted-tab-options';
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

export default function ShopperTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RootedTabBar {...props} />}
      screenOptions={rootedTabScreenOptions}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <TabIcon name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerShown: false,
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="map-marker" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="newspaper-o" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="user" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
