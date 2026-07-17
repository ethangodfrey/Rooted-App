import { Redirect } from 'expo-router';

/** Entry: creator shell currently aliases the vendor storefront/tabs. */
export default function CreatorIndex() {
  return <Redirect href="/(vendor)/(tabs)/dashboard" />;
}
