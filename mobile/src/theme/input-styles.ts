import type { ViewStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/layout';

export const INPUT_BORDER_WIDTH = 1.5;
export const INPUT_BORDER_WIDTH_FOCUSED = 2;

/** Warm glass-style field for search surfaces. */
export function inputBorderStyle(focused = false, glass = false): ViewStyle {
  if (glass) {
    return {
      borderRadius: radius.input,
      borderWidth: focused ? INPUT_BORDER_WIDTH_FOCUSED : INPUT_BORDER_WIDTH,
      borderColor: focused ? colors.primary : 'rgba(122, 116, 107, 0.25)',
      backgroundColor: 'rgba(245, 240, 234, 0.72)',
    };
  }
  return {
    borderRadius: radius.input,
    borderWidth: focused ? INPUT_BORDER_WIDTH_FOCUSED : INPUT_BORDER_WIDTH,
    borderColor: colors.primary,
    backgroundColor: colors.honeydew,
  };
}
