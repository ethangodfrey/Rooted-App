import { useCallback } from 'react';
import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { colors } from '@/src/theme/colors';
import { elevationShadow, radius } from '@/src/theme/layout';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantBackground: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.honeydew },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: '#FEE2E2' },
};

const variantLabelColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.text,
  ghost: colors.primary,
  danger: '#B91C1C',
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    scale.value = withTiming(0.97, { duration: 150 });
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 150 });
  }, [scale]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        animatedStyle,
        variant !== 'ghost' ? elevationShadow : undefined,
        { borderRadius: radius.button },
        variantBackground[variant],
      ]}
      className={`${fullWidth ? 'w-full' : 'self-start'} min-h-11 flex-row items-center justify-center px-4 py-3 ${
        isDisabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      {...props}>
      {loading ? (
        <LoadingIndicator size="small" />
      ) : (
        <Text style={{ fontSize: 16, fontWeight: '500', color: variantLabelColor[variant] }}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}
