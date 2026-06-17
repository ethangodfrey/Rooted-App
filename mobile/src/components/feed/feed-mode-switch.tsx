import { Pressable, Text, View } from 'react-native';

import type { ExploreScope, FeedMode } from '@/src/lib/shopper-feed';
import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { radius } from '@/src/theme/layout';

interface FeedModeSwitchProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  exploreScope: ExploreScope;
  onExploreScopeChange: (scope: ExploreScope) => void;
}

export function FeedModeSwitch({
  mode,
  onModeChange,
  exploreScope,
  onExploreScopeChange,
}: FeedModeSwitchProps) {
  return (
    <View className="mb-4">
      <View
        style={[inputBorderStyle(), { flexDirection: 'row', borderRadius: radius.pill, padding: 4 }]}>
        <Segment
          label="Saved vendors"
          selected={mode === 'saved'}
          onPress={() => onModeChange('saved')}
        />
        <Segment label="Explore" selected={mode === 'explore'} onPress={() => onModeChange('explore')} />
      </View>

      {mode === 'explore' ? (
        <View className="mt-3 flex-row gap-2">
          <ScopeChip
            label="Near you"
            selected={exploreScope === 'local'}
            onPress={() => onExploreScopeChange('local')}
          />
          <ScopeChip
            label="Popular nationwide"
            selected={exploreScope === 'popular'}
            onPress={() => onExploreScopeChange('popular')}
          />
        </View>
      ) : null}
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}

function ScopeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: selected ? colors.primary : colors.honeydew,
        ...(selected ? {} : inputBorderStyle()),
      }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: selected ? colors.white : colors.text,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
