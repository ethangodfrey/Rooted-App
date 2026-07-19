import { Stack, useLocalSearchParams } from 'expo-router';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { WholesaleOrderEntryScreen } from '@/src/screens/vendor/WholesaleOrderEntryScreen';

export default function VendorWholesaleOrderRoute() {
  const params = useLocalSearchParams<{ sellerVendorId?: string | string[] }>();
  const raw = params.sellerVendorId;
  const initialSellerVendorId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Wholesale order',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <WholesaleOrderEntryScreen initialSellerVendorId={initialSellerVendorId ?? null} />
    </>
  );
}
