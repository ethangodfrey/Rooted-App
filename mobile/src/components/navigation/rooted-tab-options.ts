import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { LogoHeaderTitle } from '@/src/components/Logo';
import { colors } from '@/src/theme/colors';

/** Shared tab + header styling for shopper, vendor, and admin stacks. */
export const rootedTabScreenOptions: BottomTabNavigationOptions = {
  tabBarShowLabel: false,
  headerShown: true,
  headerStyle: {
    backgroundColor: colors.white,
  },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  headerTitle: () => LogoHeaderTitle({ variant: 'primary', size: 'medium' }),
  headerTitleAlign: 'center',
};
