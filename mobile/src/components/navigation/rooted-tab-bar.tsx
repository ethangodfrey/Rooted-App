import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { router } from 'expo-router';

import type { ReactNode } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, {

  useAnimatedStyle,

  useSharedValue,

  withTiming,

} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



import { colors } from '@/src/theme/colors';
import { useNearbyOpenMarkets } from '@/src/hooks/use-nearby-open-markets';



const AnimatedPressable = Animated.createAnimatedComponent(Pressable);



/** Primary tab routes — map/explore/feed stay routable but hidden from bar. */

const VISIBLE_TAB_ROUTES = new Set(['home', 'search', 'events', 'profile']);



function TabItem({

  label,

  icon,

  isFocused,

  onPress,

  onLongPress,

  accessibilityLabel,

}: {

  label: string;

  icon: ReactNode;

  isFocused: boolean;

  onPress: () => void;

  onLongPress?: () => void;

  accessibilityLabel?: string;

}) {

  const scale = useSharedValue(1);



  const animatedStyle = useAnimatedStyle(() => ({

    transform: [{ scale: scale.value }],

  }));



  return (

    <AnimatedPressable

      accessibilityRole="button"

      accessibilityState={{ selected: isFocused }}

      accessibilityLabel={accessibilityLabel ?? label}

      onPress={onPress}

      onLongPress={onLongPress}

      onPressIn={() => {

        scale.value = withTiming(0.97, { duration: 150 });

      }}

      onPressOut={() => {

        scale.value = withTiming(1, { duration: 150 });

      }}

      style={[styles.tab, isFocused ? styles.tabActive : null, animatedStyle]}>

      <View style={styles.iconWrap}>{icon}</View>

      {isFocused ? <View style={styles.activeDot} /> : null}

      {isFocused ? (

        <Text style={styles.activeLabel} numberOfLines={1}>

          {label}

        </Text>

      ) : null}

    </AnimatedPressable>

  );

}



/** Clearance between FAB bottom edge and tab bar top (matches web 1.75rem). */
const FAB_TAB_CLEARANCE = 28;

function MapFab({ compact, pulse }: { compact?: boolean; pulse?: boolean }) {
  const scale = useSharedValue(1);
  const bounce = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * bounce.value }],
  }));

  const size = compact ? 48 : 56;
  const fabTop = -(size + FAB_TAB_CLEARANCE);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Open map"
      onPress={() => router.push('/(shopper)/(tabs)/map')}
      onPressIn={() => {
        scale.value = withTiming(0.94, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
        bounce.value = withTiming(1.08, { duration: 90 }, () => {
          bounce.value = withTiming(1, { duration: 120 });
        });
      }}
      style={[
        styles.fab,
        { width: size, height: size, borderRadius: size / 2, top: fabTop },
        pulse ? styles.fabPulse : null,
        animatedStyle,
      ]}>
      <FontAwesome name="map-marker" size={22} color={colors.surface} />
    </AnimatedPressable>
  );
}



export function RootedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const nearbyMarketsOpen = useNearbyOpenMarkets();
  const visibleRoutes = state.routes.filter((route) => VISIBLE_TAB_ROUTES.has(route.name));
  const activeRoute = state.routes[state.index]?.name;
  const fabCompact = activeRoute !== 'home';

  return (
    <View style={styles.wrapper}>
      <MapFab compact={fabCompact} pulse={nearbyMarketsOpen} />

      <View

        style={[

          styles.bar,

          {

            paddingBottom: Math.max(insets.bottom, 8),

          },

        ]}>

        {visibleRoutes.map((route) => {

          const index = state.routes.findIndex((r) => r.key === route.key);

          const { options } = descriptors[route.key];

          const isFocused = state.index === index;

          const label =

            typeof options.tabBarLabel === 'string'

              ? options.tabBarLabel

              : (options.title ?? route.name);



          const onPress = () => {

            const event = navigation.emit({

              type: 'tabPress',

              target: route.key,

              canPreventDefault: true,

            });



            if (!isFocused && !event.defaultPrevented) {

              navigation.navigate(route.name, route.params);

            }

          };



          const onLongPress = () => {

            navigation.emit({

              type: 'tabLongPress',

              target: route.key,

            });

          };



          const iconColor = isFocused ? colors.primary : colors.muted;

          const iconSize = isFocused ? 22 : 20;

          const icon =

            options.tabBarIcon?.({

              focused: isFocused,

              color: iconColor,

              size: iconSize,

            }) ?? <FontAwesome name="circle" size={iconSize} color={iconColor} />;



          return (

            <TabItem

              key={route.key}

              label={label}

              icon={icon}

              isFocused={isFocused}

              onPress={onPress}

              onLongPress={onLongPress}

              accessibilityLabel={options.tabBarAccessibilityLabel}

            />

          );

        })}

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  wrapper: {

    position: 'relative',

  },

  bar: {

    flexDirection: 'row',

    alignItems: 'flex-end',

    justifyContent: 'space-around',

    backgroundColor: 'rgba(245, 240, 234, 0.94)',

    paddingTop: 6,

    paddingHorizontal: 6,

    borderTopWidth: 1,

    borderTopColor: 'rgba(45, 42, 38, 0.08)',

    shadowColor: '#2D2A26',

    shadowOffset: { width: 0, height: -2 },

    shadowOpacity: 0.06,

    shadowRadius: 8,

    elevation: 8,

  },

  tab: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    minHeight: 44,

    paddingVertical: 4,

    gap: 3,

    borderRadius: 14,

  },

  tabActive: {

    backgroundColor: 'rgba(196, 112, 75, 0.08)',

  },

  iconWrap: {

    height: 26,

    alignItems: 'center',

    justifyContent: 'center',

  },

  activeDot: {

    width: 4,

    height: 4,

    borderRadius: 2,

    backgroundColor: colors.primary,

  },

  activeLabel: {

    fontSize: 12,

    fontWeight: '500',

    color: colors.primary,

    lineHeight: 14,

    letterSpacing: 0.1,

  },

  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPulse: {
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
});

