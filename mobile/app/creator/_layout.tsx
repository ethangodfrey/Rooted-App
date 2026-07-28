import { Redirect, Stack } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';
import { isShopperRole } from '@/src/lib/role-utils';

/** Session + role gate for the unified creator shell. */
export default function CreatorLayout() {
  const { session, user, vendor, isLoading, isProfileLoading, cacheReady, trustedCache } =
    useAuth();

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

  if (isShopperRole(role)) {
    return <Redirect href="/(onboarding)/role-select" />;
  }

  if (role !== 'vendor') {
    return <Redirect href="/" />;
  }

  const vendorComplete = user
    ? isVendorApplicationComplete(vendor)
    : (trustedCache?.vendorComplete ?? false);

  if (!vendorComplete) {
    return <Redirect href="/(vendor)/profile/setup" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
