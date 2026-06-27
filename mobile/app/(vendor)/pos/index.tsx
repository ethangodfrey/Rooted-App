import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { PosStatusPill } from '@/src/components/pos/pos-status-pill';
import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { isApiConfigured } from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/format';
import { getPosOAuthReturnUrl } from '@/src/lib/pos-oauth-return';
import { posApi } from '@/src/lib/pos-api';
import { triggerStalePosSync } from '@/src/lib/pos-sync';
import { openSquareOAuth, openSquareSandboxSetup } from '@/src/lib/square-oauth';
import type { PosConnection } from '@/src/types/pos';

const PROVIDER_LABEL: Record<string, string> = {
  SQUARE: 'Square',
  TOAST: 'Toast',
  CLOVER: 'Clover',
};

export default function PosConnectionsScreen() {
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sandboxReady, setSandboxReady] = useState(false);
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | null>(null);
  const [awaitingOAuthReturn, setAwaitingOAuthReturn] = useState(false);

  const squareActive = connections.some(
    (c) => c.provider === 'SQUARE' && c.status === 'ACTIVE',
  );

  useEffect(() => {
    if (!isApiConfigured) return;
    void posApi
      .getOAuthRedirectUri('SQUARE')
      .then((info) => setOauthRedirectUri(info.redirectUri))
      .catch(() => setOauthRedirectUri(null));
  }, []);

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setLoading(false);
      return;
    }
    try {
      const data = await posApi.listConnections();
      setConnections(data);
      setError(null);
      void triggerStalePosSync();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        await load();
        if (!active || !awaitingOAuthReturn) return;
        const data = await posApi.listConnections();
        const connected = data.some(
          (c) => c.provider === 'SQUARE' && c.status === 'ACTIVE',
        );
        if (connected) {
          setAwaitingOAuthReturn(false);
          router.replace({
            pathname: '/(vendor)/pos/connected',
            params: { status: 'success' },
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [load, awaitingOAuthReturn]),
  );

  async function connectSquare() {
    setConnecting(true);
    setError(null);
    try {
      const returnUrl = getPosOAuthReturnUrl();
      const { authorizeUrl, oauthEnvironment, connection } = await posApi.createConnection(
        'SQUARE',
        returnUrl,
      );

      if (connection.status === 'ACTIVE') {
        router.replace({
          pathname: '/(vendor)/pos/connected',
          params: { status: 'success' },
        });
        return;
      }

      if (!authorizeUrl) {
        setError('Square did not return an authorization URL.');
        return;
      }

      if (oauthEnvironment === 'sandbox' && !sandboxReady) {
        setError('Open the sandbox test account first (step 1 below), then try again.');
        return;
      }

      setAwaitingOAuthReturn(true);
      const result = await openSquareOAuth(authorizeUrl, oauthEnvironment, returnUrl);
      if (result === 'cancel') {
        setAwaitingOAuthReturn(false);
        setError('Square authorization was cancelled.');
      } else if (oauthEnvironment === 'sandbox') {
        setError(null);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function prepareSandbox() {
    setError(null);
    setSandboxReady(true);
    await openSquareSandboxSetup();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Point of Sale',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !isApiConfigured ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            POS sync isn&apos;t available yet.
          </Text>
          <Text variant="caption" className="mt-2 text-center">
            Set EXPO_PUBLIC_API_URL to the Vendorly backend to connect Square.
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <Text variant="subtitle" className="mb-4">
            Connect your register to import card sales into analytics automatically.
          </Text>

          {connections.length === 0 ? (
            <Card className="mb-4">
              <Text variant="caption">No POS connected yet.</Text>
            </Card>
          ) : (
            <View className="mb-4 gap-2">
              {connections.map((c) => (
                <PressableCard
                  key={c.id}
                  className="flex-row items-center justify-between"
                  onPress={() =>
                    router.push({ pathname: '/(vendor)/pos/[id]', params: { id: c.id } })
                  }>
                  <View className="flex-1 pr-3">
                    <Text variant="heading" className="mb-1">
                      {PROVIDER_LABEL[c.provider] ?? c.provider}
                    </Text>
                    <Text variant="caption">
                      Auto-sync every {c.syncFrequencyMinutes} min
                      {c.lastSyncedAt
                        ? ` · last synced ${formatDateTime(c.lastSyncedAt)}`
                        : ' · not synced yet'}
                    </Text>
                  </View>
                  <PosStatusPill status={c.status} />
                </PressableCard>
              ))}
            </View>
          )}

          {oauthRedirectUri ? (
            <Card className="mb-4 bg-honeydew">
              <Text variant="caption" className="mb-1 font-semibold text-ink">
                Square OAuth redirect (HTTPS)
              </Text>
              <Text variant="caption" className="mb-2">
                Add this exact URL in Square Developer Dashboard → OAuth → Sandbox redirect URL.
                Restart the backend after starting a new tunnel, or Square will reject the connect
                flow.
              </Text>
              <Text variant="caption" className="font-mono text-xs text-ink">
                {oauthRedirectUri}
              </Text>
            </Card>
          ) : null}

          {squareActive ? (
            <Card className="mb-4 bg-honeydew">
              <Text variant="caption" className="font-semibold text-ink">
                Square is already connected.
              </Text>
              <Text variant="caption" className="mt-1">
                Open the connection above to manage sync, mappings, or real-time updates.
              </Text>
            </Card>
          ) : (
            <Card className="mb-4 bg-honeydew">
              <Text variant="caption" className="mb-2 font-semibold text-ink">
                Square sandbox — do these in order
              </Text>
              <Text variant="caption" className="mb-3">
                Sandbox OAuth will show a blank page unless a test seller is open in your phone&apos;s
                browser (Safari/Chrome). The in-app browser cannot do this.
              </Text>
              <Button
                label={sandboxReady ? '1. Sandbox opened — tap to reopen' : '1. Open sandbox test account'}
                variant="secondary"
                onPress={prepareSandbox}
              />
              <Text variant="caption" className="my-2 text-center">
                In the browser: your app → Sandbox test accounts → Open → leave that tab open
              </Text>
              <Button
                label="2. Connect Square"
                loading={connecting}
                onPress={connectSquare}
              />
              <Text variant="caption" className="mt-3">
                After you tap Allow in Safari, close Safari and switch back to Vendorly manually. iOS
                cannot deep-link back into Expo Go from the browser.
              </Text>
            </Card>
          )}

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        </Screen>
      )}
    </>
  );
}
