import { View } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { colors } from '@/src/theme/colors';

export function AuthLoadingShell() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
      }}>
      <LoadingIndicator />
    </View>
  );
}
