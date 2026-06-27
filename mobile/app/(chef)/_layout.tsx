import { Redirect, Stack, useSegments } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { isChefProfileComplete } from '@/src/lib/chef-profile';

export default function ChefLayout() {
  const { session, user, chef, isLoading, isProfileLoading, cacheReady, trustedCache } = useAuth();
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

  if (role !== 'chef') {
    return <Redirect href="/" />;
  }

  const chefComplete = user
    ? isChefProfileComplete(chef)
    : (trustedCache?.chefComplete ?? false);

  if (!chefComplete && !onSetupRoute) {
    return <Redirect href="/(chef)/profile/setup" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
