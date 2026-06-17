import { Pressable, View, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { cardShadow, radius } from '@/src/theme/layout';

interface CardProps extends ViewProps {
  className?: string;
  subtle?: boolean;
}

export function Card({ className, subtle = false, style, ...props }: CardProps) {
  return (
    <View
      className={`rounded-card p-4 ${subtle ? 'bg-honeydew' : 'bg-white'} ${className ?? ''}`}
      style={[subtle ? undefined : cardShadow, { borderRadius: radius.card }, style]}
      {...props}
    />
  );
}

interface PressableCardProps extends PressableProps {
  className?: string;
  subtle?: boolean;
}

export function PressableCard({ className, subtle = false, style, ...props }: PressableCardProps) {
  const baseStyle: StyleProp<ViewStyle> = [
    subtle ? undefined : cardShadow,
    { borderRadius: radius.card },
  ];

  const resolvedStyle =
    typeof style === 'function'
      ? (state: PressableStateCallbackType) => [baseStyle, style(state)]
      : [baseStyle, style];

  return (
    <Pressable
      className={`rounded-card p-4 ${subtle ? 'bg-honeydew' : 'bg-white'} active:opacity-90 ${
        className ?? ''
      }`}
      style={resolvedStyle}
      {...props}
    />
  );
}
