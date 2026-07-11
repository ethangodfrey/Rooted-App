import { Redirect, Stack } from 'expo-router';

import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';

/** Session gate only. Role + onboarding routing lives in `app/index.tsx`. */
export default function ShopperLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading && !session) {
    return <AuthLoadingShell />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
