import { Stack } from 'expo-router';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { ReceiptScreen } from '@/src/screens/shopper/ReceiptScreen';

export default function ShopperReceiptRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'RECEIPT',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <ReceiptScreen />
    </>
  );
}
