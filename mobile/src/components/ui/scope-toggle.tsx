import { Pressable, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { radius } from '@/src/theme/layout';

export interface ScopeOption<T extends string> {
  value: T;
  label: string;
}

interface ScopeToggleProps<T extends string> {
  value: T;
  options: ScopeOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function ScopeToggle<T extends string>({
  value,
  options,
  onChange,
  className,
}: ScopeToggleProps<T>) {
  return (
    <View
      className={className}
      style={[inputBorderStyle(), { flexDirection: 'row', borderRadius: radius.pill, padding: 4 }]}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              borderRadius: radius.pill,
              backgroundColor: selected ? colors.primary : 'transparent',
              paddingVertical: 10,
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: selected ? colors.white : colors.text,
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
