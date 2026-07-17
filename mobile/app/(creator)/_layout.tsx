import { Redirect, Stack, useSegments } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';

/**
 * Creator workspace boundary (vision: `app/(creator)`).
 *
 * Today this group mirrors `(vendor)` auth gates so we can migrate routes
 * without breaking existing `/(vendor)/*` deep links. Prefer adding new
 * creator surfaces here; keep shopper-only screens under `app/(shopper)`.
 */
export default function CreatorLayout() {
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

  // Sticker role vendor owns the creator workspace; legacy deep links stay on (vendor).
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
