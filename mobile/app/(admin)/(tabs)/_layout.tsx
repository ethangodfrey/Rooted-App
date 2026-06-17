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

export default function AdminTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RootedTabBar {...props} />}
      screenOptions={rootedTabScreenOptions}>
      <Tabs.Screen
        name="vendors"
        options={{
          title: 'Vendors',
          tabBarIcon: ({ color, size }) => <TabIcon name="briefcase" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <TabIcon name="inbox" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color, size }) => <TabIcon name="bullhorn" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <TabIcon name="ellipsis-h" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
