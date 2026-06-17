import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AuthLink } from '@/src/components/auth/auth-screen';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { createSessionFromUrl } from '@/src/lib/auth-callback';
import { supabase } from '@/src/lib/supabase';
import { layoutStyles } from '@/src/theme/layout';

export default function ResetPasswordScreen() {
  const { clearPasswordRecovery } = useAuth();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function establishRecoverySession(incomingUrl?: string | null) {
      try {
        const url = incomingUrl ?? (await Linking.getInitialURL());
        if (url) {
          const established = await createSessionFromUrl(url);
          if (!established) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
              throw new Error(
                'This reset link is invalid or has expired. Request a new one from the app.',
              );
            }
          }
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            throw new Error(
              'Open the reset link from your email on this device, or request a new link.',
            );
          }
        }
        setReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start password reset.');
      }
    }

    establishRecoverySession();

    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url.includes('reset-password') || event.url.includes('type=recovery')) {
        establishRecoverySession(event.url);
      }
    });

    return () => subscription.remove();
  }, []);

  async function handleUpdatePassword() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    clearPasswordRecovery();
    await supabase.auth.signOut();
    setMessage('Password updated. Sign in with your new password.');
    setTimeout(() => router.replace('/(auth)/login'), 1500);
  }

  if (error && !ready) {
    return (
      <Screen centered>
        <Text variant="title" className="mb-3 text-center">
          Reset link problem
        </Text>
        <Text className="mb-6 text-center text-danger">{error}</Text>
        <View className="w-full max-w-sm gap-3">
          <Button
            label="Request new link"
            variant="secondary"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
          <AuthLink href="/(auth)/login">Back to sign in</AuthLink>
        </View>
      </Screen>
    );
  }

  if (!ready) {
    return (
      <Screen centered>
        <LoadingIndicator />
        <Text variant="subtitle" className="mt-4 text-center">
          Verifying reset link…
        </Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={layoutStyles.canvas}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[layoutStyles.screenScrollContent, { justifyContent: 'center' }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={layoutStyles.screenColumn}>
        <Text variant="eyebrow" className="mb-2">
          Rooted
        </Text>
        <Text variant="title" className="mb-2">
          Set a new password
        </Text>
        <Text variant="subtitle" className="mb-6">
          Choose a new password for your account.
        </Text>

        <Input
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <Input
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="Repeat password"
        />

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        {message ? <Text className="mb-3 text-sm text-primary">{message}</Text> : null}

        <View className="mt-2">
          <Button label="Update password" loading={loading} onPress={handleUpdatePassword} />
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
