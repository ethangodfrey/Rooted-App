import { Redirect, Stack, useSegments } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';

export default function VendorLayout() {
  const { session, user, vendor, isLoading, isProfileLoading, cacheReady, trustedCache } =
    useAuth();
  const segments = useSegments();
  const onSetupRoute = segments.includes('profile' as never);

  if (isLoading && !session) {
    return <AuthLoadingShell />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const role = user?.role ?? trustedCache?.role ?? null;

  if (!role && (isProfileLoading || !cacheReady)) {
    return <AuthLoadingShell />;
  }

  if (role !== 'vendor') {
    return <Redirect href="/" />;
  }

  const vendorComplete = user
    ? isVendorApplicationComplete(vendor)
    : (trustedCache?.vendorComplete ?? false);

  if (!vendorComplete && !onSetupRoute) {
    return <Redirect href="/(vendor)/profile/setup" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
