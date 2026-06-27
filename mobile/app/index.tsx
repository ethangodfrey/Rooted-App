import { Redirect } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';
import { resolveIndexRedirect } from '@/src/lib/auth-redirect';
import { isSupabaseConfigured } from '@/src/lib/supabase';

/**
 * Single source of truth for auth-based routing. Every group layout only gates
 * on session; all role / onboarding decisions happen here to avoid redirect loops.
 */
export default function Index() {
  const auth = useAuth();

  const destination = resolveIndexRedirect({
    isSupabaseConfigured,
    isLoading: auth.isLoading,
    isPasswordRecovery: auth.isPasswordRecovery,
    session: auth.session,
    user: auth.user,
    shopper: auth.shopper,
    vendor: auth.vendor,
    chef: auth.chef,
    isProfileLoading: auth.isProfileLoading,
    cacheReady: auth.cacheReady,
    trustedCache: auth.trustedCache,
  });

  if (destination === 'loading') {
    return <AuthLoadingShell />;
  }

  return <Redirect href={destination} />;
}
