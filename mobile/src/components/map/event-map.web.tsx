import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapBottomSheet } from '@/src/components/map/map-bottom-sheet';
import { MapFloatingSearch } from '@/src/components/map/map-floating-search';
import { Text } from '@/src/components/ui/text';
import { pagePadding } from '@/src/theme/layout';
import { colors } from '@/src/theme/colors';
import type { EventMapProps } from './types';

export function EventMap({
  events,
  onOpenEvent,
}: EventMapProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.honeydew }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: pagePadding,
        }}>
        <Text variant="subtitle" className="text-center">
          Interactive map is available in the iOS and Android app.
        </Text>
      </View>

      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: pagePadding,
          right: pagePadding,
        }}>
        <MapFloatingSearch value="" onChangeText={() => {}} />
      </View>

      <MapBottomSheet
        events={events}
        totalCount={events.length}
        onSelectEvent={onOpenEvent}
      />
    </View>
  );
}
