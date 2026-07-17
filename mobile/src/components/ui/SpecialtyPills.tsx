import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

type SpecialtyPillsProps = {
  specialties: readonly string[] | null | undefined;
  style?: StyleProp<ViewStyle>;
};

/** Specialty sub-stickers — uppercase text pills only, no emojis. */
export function SpecialtyPills({ specialties, style }: SpecialtyPillsProps) {
  const tags = (specialties ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tags.length === 0) return null;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {tags.map((tag) => (
        <View
          key={tag}
          accessibilityLabel={`Specialty ${tag}`}
          style={{
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: '#09090b',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
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
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}
