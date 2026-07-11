import { View, type ViewProps } from 'react-native';

import { colors } from '@/src/theme/colors';

interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <View
      className={`rounded-lg ${className ?? ''}`}
      style={[{ backgroundColor: colors.honeydew }, style]}
      {...props}
    />
  );
}

export function HomeSectionSkeleton() {
  return (
    <View className="mb-6">
      <Skeleton className="mb-3 h-6 w-36 rounded-md" />
      <View className="flex-row gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[160px] w-[220px] rounded-card" />
        ))}
      </View>
    </View>
  );
}
