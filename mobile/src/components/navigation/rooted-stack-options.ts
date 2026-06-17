import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors } from '@/src/theme/colors';

export const rootedStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
  },
  headerBackTitle: 'Back',
  animation: 'fade',
};
