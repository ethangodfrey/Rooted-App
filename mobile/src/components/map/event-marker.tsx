import { Text, View } from 'react-native';

import type { EventRuntimePhase } from '@/src/lib/event-runtime';
import { colors } from '@/src/theme/colors';
import { floatingShadow, radius } from '@/src/theme/layout';

interface EventMarkerProps {
  label: string;
  selected?: boolean;
  phase?: EventRuntimePhase;
}

const PHASE_BG: Record<EventRuntimePhase, string> = {
  live: colors.primary,
  upcoming: colors.accent,
  closed: '#9CA3AF',
  cancelled: '#B91C1C',
};

export function EventMarker({ label, selected = false, phase = 'upcoming' }: EventMarkerProps) {
  const backgroundColor = selected ? colors.primary : PHASE_BG[phase];

  return (
    <View
      style={[
        floatingShadow,
        {
          borderRadius: radius.pill,
          backgroundColor,
          paddingHorizontal: 10,
          paddingVertical: 6,
          minWidth: 44,
          alignItems: 'center',
          opacity: phase === 'closed' ? 0.85 : 1,
        },
      ]}>
      <Text
        style={{
          color: colors.white,
          fontSize: 12,
          fontWeight: '700',
        }}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
