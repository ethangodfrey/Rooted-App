import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';



import { LogoHeaderTitle } from '@/src/components/Logo';
import { colors } from '@/src/theme/colors';



/** Shared tab + header styling for shopper, vendor, and admin stacks. */

export const rootedTabScreenOptions: BottomTabNavigationOptions = {

  tabBarShowLabel: false,

  headerShown: true,

  headerStyle: {

    backgroundColor: colors.cream,

    height: 52,

  },

  headerTintColor: colors.primary,

  headerShadowVisible: false,
  headerTitle: () => LogoHeaderTitle({ variant: 'primary', size: 'medium' }),
  headerTitleAlign: 'center',
};



export const screenHeaderTitleStyle = {

  fontSize: 28,

  fontWeight: '700' as const,

  color: colors.text,

};


