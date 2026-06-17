import { router, Stack, useLocalSearchParams } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';

/**
 * OAuth return landing screen. Square → backend callback → deep link here with
 * ?status=success|error. We show brief feedback then return to the POS list.
 */
export default function PosConnectedScreen() {
  const { status, detail } = useLocalSearchParams<{ status?: string; detail?: string }>();
  const ok = status === 'success';

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(vendor)/pos');
    }, ok ? 1200 : 2800);
    return () => clearTimeout(timer);
  }, [ok]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen centered>
        <View className="mb-4">
          <LoadingIndicator />
        </View>
        <Text variant="heading" className="mb-2 text-center">
          {ok ? 'Square connected' : 'Connection failed'}
        </Text>
        <Text variant="caption" className="text-center">
          {ok
            ? 'Starting your first sync…'
            : (detail ?? 'Something went wrong during authorization.')}
        </Text>
      </Screen>
    </>
  );
}
