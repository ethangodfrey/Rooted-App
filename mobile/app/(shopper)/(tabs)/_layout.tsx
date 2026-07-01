import FontAwesome from '@expo/vector-icons/FontAwesome';



import { Tabs } from 'expo-router';



import type { ComponentProps } from 'react';

import { Text } from 'react-native';



import { Logo } from '@/src/components/Logo';

import { RootedTabBar } from '@/src/components/navigation/rooted-tab-bar';

import {

  rootedTabScreenOptions,

  screenHeaderTitleStyle,

} from '@/src/components/navigation/rooted-tab-options';



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



export default function ShopperTabsLayout() {

  return (

    <Tabs tabBar={(props) => <RootedTabBar {...props} />} screenOptions={rootedTabScreenOptions}>

      <Tabs.Screen

        name="home"

        options={{

          title: 'Home',

          headerTitle: () => <Logo size="small" />,
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
          ),

        }}

      />

      <Tabs.Screen

        name="search"

        options={{

          title: 'Discover',

          headerTitle: () => <ScreenTitle>Discover</ScreenTitle>,
          headerTitleAlign: 'left',
          lazy: true,

          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="search" color={color} size={size} focused={focused} />
          ),

        }}

      />

      <Tabs.Screen

        name="events"

        options={{

          title: 'Markets',

          headerTitle: () => <ScreenTitle>Markets</ScreenTitle>,
          headerTitleAlign: 'left',
          lazy: true,

          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="calendar" color={color} size={size} focused={focused} />
          ),

        }}

      />

      <Tabs.Screen

        name="profile"

        options={{

          title: 'You',

          headerTitle: () => <ScreenTitle>You</ScreenTitle>,
          headerTitleAlign: 'left',
          lazy: true,

          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="user" color={color} size={size} focused={focused} />
          ),

        }}

      />

      <Tabs.Screen name="explore" options={{ href: null, lazy: true }} />

      <Tabs.Screen name="map" options={{ href: null, headerShown: false, lazy: true }} />

      <Tabs.Screen

        name="feed"

        options={{

          href: null,

          lazy: true,

          headerTitle: () => <ScreenTitle>Updates</ScreenTitle>,
          headerTitleAlign: 'left',
        }}

      />

    </Tabs>

  );

}


