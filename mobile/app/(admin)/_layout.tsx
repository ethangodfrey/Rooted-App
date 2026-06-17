import { Redirect, Stack } from 'expo-router';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { AuthLoadingShell } from '@/src/components/ui/auth-loading-shell';
import { useAuth } from '@/src/hooks/use-auth';

export default function AdminLayout() {
  const { session, user, isLoading, cacheReady, trustedCache } = useAuth();

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

  if (role !== 'admin') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="vendors/[id]"
        options={{ headerShown: true, title: 'Vendor review', ...rootedStackScreenOptions }}
      />
      <Stack.Screen
        name="events/new"
        options={{ headerShown: true, title: 'New event', ...rootedStackScreenOptions }}
      />
      <Stack.Screen
        name="events/[id]"
        options={{ headerShown: true, title: 'Edit event', ...rootedStackScreenOptions }}
      />
      <Stack.Screen
        name="orders/[id]"
        options={{ headerShown: true, title: 'Order detail', ...rootedStackScreenOptions }}
      />
      <Stack.Screen
        name="posts/[id]"
        options={{ headerShown: true, title: 'Post review', ...rootedStackScreenOptions }}
      />
    </Stack>
  );
}
