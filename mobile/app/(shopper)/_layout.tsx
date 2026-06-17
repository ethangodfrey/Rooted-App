import { Redirect, Stack } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';

export default function ShopperLayout() {
  const { session, user, shopper, isLoading, cacheReady, trustedCache } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!cacheReady) {
    return <AuthLoadingShell />;
  }

  const role = user?.role ?? trustedCache?.role ?? null;

  if (role !== 'shopper') {
    return <Redirect href="/" />;
  }

  const hasInterests = user
    ? (shopper?.interests?.length ?? 0) > 0
    : (trustedCache?.hasInterests ?? false);

  if (!hasInterests) {
    return <Redirect href="/(onboarding)/interests" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
