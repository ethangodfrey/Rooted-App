import { Pressable, Text, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { radius } from '@/src/theme/layout';

interface ChipProps extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
  className?: string;
}

export function Chip({ label, selected = false, className, ...props }: ChipProps) {
  const containerStyle: ViewStyle = {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: selected ? colors.primary : colors.honeydew,
    ...(selected ? {} : inputBorderStyle()),
  };

  const labelStyle: TextStyle = {
    fontSize: 14,
    fontWeight: '500',
    color: selected ? colors.white : colors.text,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={containerStyle}
      className={`active:opacity-90 ${className ?? ''}`}
      {...props}>
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}
