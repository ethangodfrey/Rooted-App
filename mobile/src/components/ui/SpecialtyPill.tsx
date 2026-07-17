import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { specialtyLabel } from '@/src/lib/specialties';

type SpecialtyPillProps = {
  specialty: string;
  style?: StyleProp<ViewStyle>;
};

/** Text-only specialty tag with human-readable uppercase label. */
export function SpecialtyPill({ specialty, style }: SpecialtyPillProps) {
  const label = specialtyLabel(specialty);
  return (
    <View
      accessibilityLabel={`Specialty ${label}`}
      style={[
        {
          borderWidth: 1,
          borderColor: '#27272a',
          backgroundColor: 'rgba(9, 9, 11, 0.8)',
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
