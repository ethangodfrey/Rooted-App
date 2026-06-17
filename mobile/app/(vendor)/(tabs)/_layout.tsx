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

export default function VendorTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RootedTabBar {...props} />}
      screenOptions={rootedTabScreenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="inbox" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="tags" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Posts',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="bullhorn" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Profile',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="user" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
