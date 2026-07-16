import { Redirect } from 'expo-router';

/** Deprecated — unified inbox lives at /(shopper)/(tabs)/inbox. */
export default function DeprecatedShopperMessages() {
  return <Redirect href="/(shopper)/(tabs)/inbox" />;
}
