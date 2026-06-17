import { View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { formatCurrentClock } from '@/src/lib/format';
import { useNow } from '@/src/hooks/use-now';
import { colors } from '@/src/theme/colors';

export function EventLiveClock({ compact = false }: { compact?: boolean }) {
  const now = useNow(1000);

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`mb-3 flex-row items-center gap-2 rounded-xl border px-3 py-2${compact ? '' : ''}`}
      style={{
        borderColor: 'rgba(34, 139, 34, 0.2)',
        backgroundColor: colors.honeydew,
      }}>
      <Text style={{ fontSize: compact ? 12 : 13, color: colors.primary }}>◷</Text>
      <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
        Now
      </Text>
      <Text
        variant="caption"
        style={{ flex: 1, color: colors.text, fontVariant: ['tabular-nums'] }}>
        {formatCurrentClock(now)}
      </Text>
    </View>
  );
}
