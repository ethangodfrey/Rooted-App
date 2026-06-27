import { View, Text, type TextProps, type TextStyle } from 'react-native';

import { VENDORLY_TAGLINE } from '@/src/lib/branding';
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

/** Muted/translucent tone for the "Marketplace™" sub-line, per variant. */
const SUB_COLORS: Record<LogoVariant, string> = {
  primary: colors.muted,
  reversed: 'rgba(255,255,255,0.75)',
  dark: colors.muted,
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
  /** Show the "Marketplace™" sub-line under the wordmark. */
  showSubline?: boolean;
  /** Show the marketing tagline below the wordmark. */
  showTagline?: boolean;
  /** Accessibility label override. */
  accessibilityLabel?: string;
}

/**
 * Vendorly wordmark — Quicksand Semi-Bold.
 */
export function Logo({
  variant = 'primary',
  size = 'medium',
  showSubline = false,
  showTagline = false,
  accessibilityLabel = 'Vendorly',
  style,
  ...props
}: LogoProps) {
  const sizeStyle = SIZE_STYLES[size];
  const wordmarkSize = sizeStyle.fontSize as number;
  const tracking = wordmarkSize * 0.03;
  const subSize = Math.round(wordmarkSize * 0.32);

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      style={{ alignItems: 'flex-start' }}>
      <Text
        style={[
          {
            fontFamily: LOGO_FONT_FAMILY,
            color: VARIANT_COLORS[variant],
            letterSpacing: tracking,
            includeFontPadding: false,
            ...sizeStyle,
          },
          style,
        ]}
        {...props}>
        Vendorly
      </Text>
      {showSubline ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: subSize * 0.2 }}>
          <Text
            style={{
              fontFamily: LOGO_FONT_FAMILY,
              color: SUB_COLORS[variant],
              fontSize: subSize,
              lineHeight: subSize + 2,
              letterSpacing: subSize * 0.42,
              textTransform: 'uppercase',
              includeFontPadding: false,
            }}>
            Marketplace
          </Text>
          <Text
            style={{
              fontFamily: LOGO_FONT_FAMILY,
              color: SUB_COLORS[variant],
              fontSize: Math.round(subSize * 0.7),
              lineHeight: Math.round(subSize * 0.7),
              letterSpacing: 0,
              opacity: 0.85,
              includeFontPadding: false,
              marginLeft: 1,
              marginBottom: 1,
            }}>
            ™
          </Text>
        </View>
      ) : null}
      {showTagline ? (
        <Text
          style={{
            fontFamily: LOGO_FONT_FAMILY,
            color: SUB_COLORS[variant],
            fontSize: Math.round(wordmarkSize * 0.34),
            lineHeight: Math.round(wordmarkSize * 0.44),
            letterSpacing: 0.2,
            includeFontPadding: false,
            marginTop: subSize * 0.55,
            fontWeight: '500',
          }}>
          {VENDORLY_TAGLINE}
        </Text>
      ) : null}
    </View>
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
