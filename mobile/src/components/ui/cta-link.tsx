import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text } from 'react-native';

import { colors } from '@/src/theme/colors';
import { elevationShadow, radius } from '@/src/theme/layout';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CtaLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function CtaLink({ label, onPress, disabled = false }: CtaLinkProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 150 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      style={[
        animatedStyle,
        elevationShadow,
        { borderRadius: radius.button, backgroundColor: colors.accent },
      ]}
      className="w-full flex-row items-center justify-between px-4 py-3.5 active:opacity-90">
      <Text className="text-base font-medium text-white">{label}</Text>
      <FontAwesome name="arrow-right" size={16} color="#FFFFFF" />
    </AnimatedPressable>
  );
}
