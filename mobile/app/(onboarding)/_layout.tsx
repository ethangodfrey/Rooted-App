import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/hooks/use-auth';

export default function OnboardingLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role-select" />
      <Stack.Screen name="interests" />
    </Stack>
  );
}
