import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/hooks/use-auth';

export default function AuthLayout() {
  const { session, user, isLoading } = useAuth();

  if (!isLoading && session && user?.role) {
    return <Redirect href="/" />;
  }

  if (!isLoading && session && user && !user.role) {
    return <Redirect href="/(onboarding)/role-select" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
