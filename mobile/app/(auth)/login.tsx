import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthLink, AuthScreen } from '@/src/components/auth/auth-screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { isAdminDevEmail } from '@/src/lib/admin-dev';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAdminLogin = useMemo(() => isAdminDevEmail(email), [email]);

  async function handleLogin() {
    if (!isSupabaseConfigured) {
      setError('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace('/');
  }

  async function handleAdminLogin() {
    if (!isSupabaseConfigured) {
      setError('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env');
      return;
    }

    if (!password) {
      setError('Enter your password to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const userId = signInData.user?.id;
    if (!userId) {
      setLoading(false);
      setError('Could not read signed-in user.');
      return;
    }

    const { error: roleError } = await supabase
      .from('users')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', userId);

    setLoading(false);

    if (roleError) {
      setError(roleError.message);
      return;
    }

    await refreshUser();
    router.replace('/(admin)/(tabs)/vendors');
  }

  if (!isSupabaseConfigured) {
    return (
      <View className="flex-1 justify-center bg-canvas px-6">
        <Text variant="heading" className="mb-3">
          Supabase not configured
        </Text>
        <Text variant="subtitle">
          Copy mobile/.env.example to mobile/.env and add your Supabase project URL and anon key.
          Then run docs/supabase/phase1_auth.sql in the Supabase SQL Editor.
        </Text>
      </View>
    );
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to discover local markets and vendors."
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
      submitLabel="Sign in"
      loading={loading}
      error={error}
      footer={
        <>
          <AuthLink href="/(auth)/forgot-password">Forgot password?</AuthLink>
          <AuthLink href="/(auth)/signup">Create an account</AuthLink>
          {showAdminLogin ? (
            <Pressable
              accessibilityRole="button"
              className="mt-8 items-center py-1"
              disabled={loading}
              onPress={handleAdminLogin}>
              <Text className="text-xs text-forest-600">Admin login</Text>
            </Pressable>
          ) : null}
        </>
      }
    />
  );
}
