import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  legend?: ReactNode;
}

export function ChartCard({ title, subtitle, children, legend }: ChartCardProps) {
  return (
    <Card className="mb-4">
      <Text variant="heading" className="mb-0.5">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" className="mb-3">
          {subtitle}
        </Text>
      ) : (
        <View className="mb-3" />
      )}
      {children}
      {legend ? <View className="mt-3">{legend}</View> : null}
    </Card>
  );
}

interface LegendRowProps {
  color: string;
  label: string;
  value?: string;
}

export function LegendRow({ color, label, value }: LegendRowProps) {
  return (
    <View className="mb-1.5 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="mr-2 h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
        <Text variant="caption">{label}</Text>
      </View>
      {value ? (
        <Text variant="caption" className="font-semibold">
          {value}
        </Text>
      ) : null}
    </View>
  );
}
