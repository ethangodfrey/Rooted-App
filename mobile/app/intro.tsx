import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Logo } from '@/src/components/Logo';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { hasSeenWelcome } from '@/src/lib/welcome-storage';
import { colors } from '@/src/theme/colors';

const INTRO_MS = 900;
const AUTH_WAIT_MS = 5_000;

export default function IntroScreen() {
  const { session, isLoading } = useAuth();
  const advancingRef = useRef(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAuthTimedOut(true), AUTH_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const authReady = !isLoading || authTimedOut;

  const goNext = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (session) {
      router.replace('/');
      return;
    }

    const seen = await hasSeenWelcome();
    router.replace(seen ? '/(auth)/login' : '/welcome');
  }, [session]);

  useEffect(() => {
    if (!authReady) return;

    if (session) {
      router.replace('/');
      return;
    }

    const timer = setTimeout(() => {
      goNext();
    }, INTRO_MS);

    return () => clearTimeout(timer);
  }, [authReady, session, goNext]);

  return (
    <Pressable
      className="flex-1"
      onPress={goNext}
      disabled={!authReady}
      accessibilityRole="button"
      accessibilityLabel="Continue">
      <Screen centered>
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-card bg-honeydew">
          <FontAwesome name="leaf" size={28} color={colors.primary} />
        </View>

        <Logo variant="primary" size="large" style={{ marginBottom: 8, alignSelf: 'center' }} />
        <Text variant="subtitle" className="mb-8 text-center">
          Local markets. Local makers.
        </Text>

        <LoadingIndicator size="small" />
      </Screen>
    </Pressable>
  );
}
