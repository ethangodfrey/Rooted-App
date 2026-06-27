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

export default function ChefTabsLayout() {
  return (
    <Tabs tabBar={(props) => <RootedTabBar {...props} />} screenOptions={rootedTabScreenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="cutlery" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          lazy: true,
          tabBarIcon: ({ color, size }) => <TabIcon name="picture-o" color={color} size={size} />,
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
