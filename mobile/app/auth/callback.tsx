import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { createSessionFromUrl, isRecoveryUrl } from '@/src/lib/auth-callback';

export default function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await createSessionFromUrl(initialUrl);
          if (isRecoveryUrl(initialUrl)) {
            router.replace('/auth/reset-password');
            return;
          }
        }
        router.replace('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not complete sign in.');
      }
    }

    handleCallback();
  }, []);

  if (error) {
    return (
      <Screen centered>
        <Text className="mb-4 text-center text-danger">{error}</Text>
        <Pressable onPress={() => router.replace('/(auth)/login')} className="active:opacity-80">
          <Text className="text-base font-semibold text-primary">Back to sign in</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen centered>
      <LoadingIndicator />
    </Screen>
  );
}
