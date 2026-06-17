import { Redirect } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { resolveAuthRedirect } from '@/src/lib/auth-redirect';
import { isSupabaseConfigured } from '@/src/lib/supabase';

export default function Index() {
  const {
    session,
    user,
    shopper,
    vendor,
    isLoading,
    isPasswordRecovery,
    cacheReady,
    trustedCache,
  } = useAuth();
  const sessionUserId = session?.user.id;

  if (!isSupabaseConfigured) {
    return <Redirect href="/intro" />;
  }

  if (isLoading || !cacheReady) {
    return <AuthLoadingShell />;
  }

  if (isPasswordRecovery) {
    return <Redirect href="/auth/reset-password" />;
  }

  if (!session) {
    return <Redirect href="/intro" />;
  }

  if (!user && !trustedCache) {
    return <Redirect href="/(onboarding)/role-select" />;
  }

  const destination = resolveAuthRedirect(
    user,
    shopper,
    vendor,
    trustedCache,
    sessionUserId ?? null,
  );

  return <Redirect href={destination ?? '/(onboarding)/role-select'} />;
}
