import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Quicksand_600SemiBold,
  useFonts as useQuicksandFonts,
} from '@expo-google-fonts/quicksand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import 'react-native-reanimated';

import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { AuthProvider } from '@/src/providers/auth-provider';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [quicksandLoaded] = useQuicksandFonts({ Quicksand_600SemiBold });
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (quicksandLoaded && fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [quicksandLoaded, fontsLoaded]);

  if (!quicksandLoaded || !fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, ...rootedStackScreenOptions }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth/callback" options={{ title: 'Signing in…' }} />
        <Stack.Screen name="auth/reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(shopper)" />
        <Stack.Screen name="(vendor)" />
        <Stack.Screen name="(chef)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </ThemeProvider>
  );
}
