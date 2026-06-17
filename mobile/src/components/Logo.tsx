import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors } from '@/src/theme/colors';

/** Quicksand Semi-Bold — loaded in app/_layout.tsx */
export const LOGO_FONT_FAMILY = 'Quicksand_600SemiBold';

export type LogoVariant = 'primary' | 'reversed' | 'dark';
export type LogoSize = 'small' | 'medium' | 'large';

const VARIANT_COLORS: Record<LogoVariant, string> = {
  primary: colors.primary,
  reversed: colors.white,
  dark: colors.sage,
};

/** Font size tuned so cap-height reads at target logo height (24 / 32 / 40px). */
const SIZE_STYLES: Record<LogoSize, TextStyle> = {
  small: { fontSize: 24, lineHeight: 24 },
  medium: { fontSize: 32, lineHeight: 32 },
  large: { fontSize: 40, lineHeight: 40 },
};

export interface LogoProps extends Omit<TextProps, 'children'> {
  /** Color treatment for background context. */
  variant?: LogoVariant;
  /** Display size — small (nav), medium (header), large (splash). */
  size?: LogoSize;
  /** Accessibility label override. */
  accessibilityLabel?: string;
}

/**
 * Rooted wordmark — "Rooted" in Quicksand Semi-Bold.
 * Option C: no decorative accent; typography only.
 */
export function Logo({
  variant = 'primary',
  size = 'medium',
  accessibilityLabel = 'Rooted',
  style,
  ...props
}: LogoProps) {
  const sizeStyle = SIZE_STYLES[size];
  const tracking = (sizeStyle.fontSize as number) * 0.03;

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          fontFamily: LOGO_FONT_FAMILY,
          color: VARIANT_COLORS[variant],
          letterSpacing: tracking,
          includeFontPadding: false,
        },
        sizeStyle,
        style,
      ]}
      {...props}>
      Rooted
    </Text>
  );
}

/** Centered wordmark for navigation headers. */
export function LogoHeaderTitle({
  variant = 'primary',
  size = 'medium',
}: {
  variant?: LogoVariant;
  size?: LogoSize;
}) {
  return <Logo variant={variant} size={size} />;
}
