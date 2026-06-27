import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { formatOAuthError } from '@/src/lib/oauth-error';
import { signInWithApple, signInWithGoogle, type OAuthProvider } from '@/src/lib/oauth';

interface OAuthButtonsProps {
  disabled?: boolean;
  onSuccess?: () => void;
}

export function OAuthButtons({ disabled = false, onSuccess }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: OAuthProvider, signIn: () => Promise<boolean>) {
    setLoadingProvider(provider);
    setError(null);

    try {
      const signedIn = await signIn();
      if (signedIn) {
        onSuccess?.();
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ERR_REQUEST_CANCELED')) {
        return;
      }
      setError(formatOAuthError(err, provider));
    } finally {
      setLoadingProvider(null);
    }
  }

  const busy = disabled || loadingProvider !== null;

  return (
    <View className="mt-4">
      <Text className="mb-3 text-center text-sm text-muted">or continue with</Text>

      <Button
        label={loadingProvider === 'google' ? 'Signing in…' : 'Continue with Google'}
        variant="secondary"
        loading={loadingProvider === 'google'}
        disabled={busy}
        onPress={() => void handleOAuth('google', signInWithGoogle)}
      />

      <View className="mt-3">
        <Button
          label={loadingProvider === 'apple' ? 'Signing in…' : 'Continue with Apple'}
          variant="secondary"
          loading={loadingProvider === 'apple'}
          disabled={busy}
          onPress={() => void handleOAuth('apple', signInWithApple)}
        />
      </View>

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
