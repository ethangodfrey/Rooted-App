import type { ViewStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/layout';

export const INPUT_BORDER_WIDTH = 1.5;
export const INPUT_BORDER_WIDTH_FOCUSED = 2;

/** Green-bordered field style used on auth, welcome-back flows, and all form inputs. */
export function inputBorderStyle(focused = false): ViewStyle {
  return {
    borderRadius: radius.input,
    borderWidth: focused ? INPUT_BORDER_WIDTH_FOCUSED : INPUT_BORDER_WIDTH,
    borderColor: colors.primary,
    backgroundColor: colors.honeydew,
  };
}
