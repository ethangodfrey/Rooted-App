import { StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '@/src/theme/colors';

export const radius = {
  card: 20,
  bento: 24,
  button: 14,
  input: 16,
  pill: 999,
} as const;

/** Horizontal inset — keeps cards and buttons off the screen edges. */
export const pagePadding = 24;
export const sectionGap = 18;
export const componentGap = 12;
export const tabBarClearance = 96;

/** Shadow only — use with an explicit backgroundColor on buttons/CTAs. */
export const elevationShadow: ViewStyle = {
  shadowColor: '#2D2A26',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 4,
};

export const cardShadow: ViewStyle = {
  backgroundColor: colors.white,
  ...elevationShadow,
};

export const floatingShadow: ViewStyle = {
  backgroundColor: colors.white,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 6,
};

export const layoutStyles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  screenGutter: {
    flex: 1,
    paddingHorizontal: pagePadding,
    paddingTop: 16,
  },
  screenScrollContent: {
    flexGrow: 1,
    paddingHorizontal: pagePadding,
    paddingTop: 16,
    paddingBottom: tabBarClearance,
  },
  screenColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: tabBarClearance,
    gap: componentGap,
  },
  listContentLoose: {
    paddingBottom: tabBarClearance,
    gap: sectionGap,
  },
  stackContent: {
    paddingHorizontal: pagePadding,
    paddingTop: 16,
    paddingBottom: 32,
  },
  stackListContent: {
    paddingBottom: 32,
    gap: componentGap,
  },
});
