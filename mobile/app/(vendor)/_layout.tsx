import { Redirect, Stack, useSegments } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';

export default function VendorLayout() {
  const { session, user, vendor, isLoading, cacheReady, trustedCache } = useAuth();
  const segments = useSegments();
  const onSetupRoute = segments.includes('profile' as never);

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!cacheReady) {
    return <AuthLoadingShell />;
  }

  const role = user?.role ?? trustedCache?.role ?? null;

  if (!role) {
    return <Redirect href="/(onboarding)/role-select" />;
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
