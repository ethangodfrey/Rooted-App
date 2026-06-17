import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable } from 'react-native';

import { colors } from '@/src/theme/colors';
import { floatingShadow } from '@/src/theme/layout';

interface MapFloatingControlProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
  accessibilityLabel: string;
}

export function MapFloatingControl({ icon, onPress, accessibilityLabel }: MapFloatingControlProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        floatingShadow,
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}>
      <FontAwesome name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}
