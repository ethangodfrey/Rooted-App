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
import { cardShadow, radius } from '@/src/theme/layout';

const INTRO_MS = 1_800;
const AUTH_WAIT_MS = 1_200;

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
      if (advancingRef.current) return;
      advancingRef.current = true;
      router.replace('/');
      return;
    }

    const timer = setTimeout(() => {
      void goNext();
    }, INTRO_MS);

    return () => clearTimeout(timer);
  }, [authReady, session, goNext]);

  return (
    <Pressable
      className="flex-1 active:opacity-95"
      onPress={goNext}
      disabled={!authReady}
      accessibilityRole="button"
      accessibilityLabel="Continue">
      <Screen centered>
        <View
          className="mb-8 h-20 w-20 items-center justify-center rounded-bento"
          style={[{ backgroundColor: colors.warmSageAlt }, cardShadow, { borderRadius: radius.bento }]}>
          <FontAwesome name="leaf" size={32} color={colors.primary} />
        </View>

        <Logo variant="primary" size="large" style={{ marginBottom: 12, alignSelf: 'center' }} />
        <Text variant="subtitle" className="mb-2 text-center font-semibold text-accent">
          Local markets. Local makers.
        </Text>
        <Text variant="caption" className="mb-10 text-center" style={{ opacity: 0.75 }}>
          Tap anywhere to continue
        </Text>

        <LoadingIndicator size="small" />
      </Screen>
    </Pressable>
  );
}
