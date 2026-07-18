import { Stack } from 'expo-router';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { HandoffScanner } from '@/src/screens/vendor/HandoffScanner';

export default function VendorHandoffScannerRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'VERIFY TOKEN',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <HandoffScanner />
    </>
  );
}
