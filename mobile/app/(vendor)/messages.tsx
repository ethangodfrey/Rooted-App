import { Redirect } from 'expo-router';

/** Deprecated — shopper/creator messaging uses the unified inbox. */
export default function DeprecatedVendorMessages() {
  return <Redirect href="/(shopper)/(tabs)/inbox" />;
}
