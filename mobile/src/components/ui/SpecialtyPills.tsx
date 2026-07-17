import { View, type StyleProp, type ViewStyle } from 'react-native';

import { SpecialtyPill } from '@/src/components/ui/SpecialtyPill';

type SpecialtyPillsProps = {
  specialties: readonly string[] | null | undefined;
  style?: StyleProp<ViewStyle>;
};

export function SpecialtyPills({ specialties, style }: SpecialtyPillsProps) {
  const tags = (specialties ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {tags.map((tag) => (
        <SpecialtyPill key={tag} specialty={tag} />
      ))}
    </View>
  );
}
