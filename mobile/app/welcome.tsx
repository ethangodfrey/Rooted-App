import { FontAwesome } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Logo } from '@/src/components/Logo';
import { CtaLink } from '@/src/components/ui/cta-link';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { hasSeenWelcome, markWelcomeSeen } from '@/src/lib/welcome-storage';
import { colors } from '@/src/theme/colors';

const AUTH_WAIT_MS = 5_000;

export default function WelcomeScreen() {
  const { session, isLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAuthTimedOut(true), AUTH_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const authReady = !isLoading || authTimedOut;

  useEffect(() => {
    let active = true;

    async function guard() {
      if (session) {
        router.replace('/');
        return;
      }

      const seen = await hasSeenWelcome();
      if (!active) return;

      if (seen) {
        router.replace('/(auth)/login');
        return;
      }

      setChecking(false);
    }

    if (authReady) {
      guard();
    }

    return () => {
      active = false;
    };
  }, [authReady, session]);

  if (session) {
    return <Redirect href="/" />;
  }

  async function handleContinue() {
    await markWelcomeSeen();
    router.replace('/(auth)/login');
  }

  if (!authReady || checking) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  return (
    <Screen centered>
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-card bg-honeydew">
        <FontAwesome name="leaf" size={28} color={colors.primary} />
      </View>

      <Text variant="eyebrow" className="mb-2 text-center">
        Welcome to
      </Text>
      <Logo variant="primary" size="large" style={{ marginBottom: 8, alignSelf: 'center' }} />
      <Text variant="subtitle" className="mb-8 text-center">
        Discover local markets, follow makers, and reserve pickup from vendors near you.
      </Text>

      <CtaLink label="Want to get Rooted?" onPress={handleContinue} />
    </Screen>
  );
}
