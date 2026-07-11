import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme/colors';

interface LoadingIndicatorProps {
  size?: 'small' | 'large';
}

export function LoadingIndicator({ size = 'large' }: LoadingIndicatorProps) {
  const opacity = useSharedValue(0.35);
  const dimension = size === 'small' ? 16 : 24;

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: colors.harvest,
        },
        animatedStyle,
      ]}
    />
  );
}
