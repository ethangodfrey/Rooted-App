import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { PosStatusPill } from '@/src/components/pos/pos-status-pill';
import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { formatDateTime, formatRelativeTime } from '@/src/lib/format';
import { posApi } from '@/src/lib/pos-api';
import type { PosConnection, PosSyncRun } from '@/src/types/pos';

const PROVIDER_LABEL: Record<string, string> = {
  SQUARE: 'Square',
  TOAST: 'Toast',
  CLOVER: 'Clover',
};

export default function PosConnectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [connection, setConnection] = useState<PosConnection | null>(null);
  const [runs, setRuns] = useState<PosSyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [enablingWebhook, setEnablingWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [conn, syncRuns] = await Promise.all([
        posApi.getConnection(id),
        posApi.listSyncRuns(id),
      ]);
      setConnection(conn);
      setRuns(syncRuns);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function syncNow() {
    if (!id) return;
    setSyncing(true);
    setError(null);
    try {
      await posApi.triggerSync(id);
      // Give the worker a moment, then refresh the run list.
      setTimeout(() => {
        load();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function enableWebhook() {
    if (!id) return;
    setEnablingWebhook(true);
    setError(null);
    try {
      const updated = await posApi.registerWebhook(id);
      setConnection(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnablingWebhook(false);
    }
  }

  function confirmDisconnect() {
    if (!id) return;
    Alert.alert('Disconnect POS', 'Stop syncing and remove stored credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await posApi.disconnect(id);
            router.back();
          } catch (err) {
            setError((err as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: connection ? (PROVIDER_LABEL[connection.provider] ?? 'POS') : 'POS',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !connection ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'Connection not found.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text variant="heading" className="mb-0">
                Status
              </Text>
              <PosStatusPill status={connection.status} />
            </View>
            <Row label="Merchant" value={connection.providerMerchantId ?? '—'} />
            <Row label="Location" value={connection.providerLocationId ?? '—'} />
            <Row
              label="Last synced"
              value={
                connection.lastSyncedAt ? formatRelativeTime(connection.lastSyncedAt) : 'Never'
              }
            />
            <Row label="Auto-sync" value={`Every ${connection.syncFrequencyMinutes} min`} />
            <Row
              label="Real-time updates"
              value={connection.metadata?.webhookSubscriptionId ? 'On' : 'Off'}
            />
            <Text variant="caption" className="mt-2 text-stone-500">
              Sales import automatically on this schedule while the backend is running. Enable
              real-time updates for instant sync after each Square sale.
            </Text>
            {connection.errorMessage ? (
              <Text className="mt-2 text-sm text-danger">{connection.errorMessage}</Text>
            ) : null}
          </Card>

          <View className="mb-4 gap-3">
            <Button label="Sync now" loading={syncing} onPress={syncNow} />
            {connection.metadata?.webhookSubscriptionId ? null : (
              <Button
                label="Enable real-time updates"
                variant="secondary"
                loading={enablingWebhook}
                onPress={enableWebhook}
              />
            )}
            <PressableCard
              className="flex-row items-center justify-between"
              onPress={() => router.push('/(vendor)/pos/mappings')}>
              <View className="flex-1 pr-3">
                <Text variant="heading" className="mb-1">
                  Item mappings
                </Text>
                <Text variant="caption">Match register items to your Rooted products.</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#9CAF88" />
            </PressableCard>
          </View>

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          <Text variant="heading" className="mb-3">
            Recent syncs
          </Text>
          {runs.length === 0 ? (
            <Text variant="caption" className="mb-6">
              No sync runs yet.
            </Text>
          ) : (
            <View className="mb-6 gap-2">
              {runs.map((run) => (
                <Card key={run.id}>
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text variant="body" className="font-semibold">
                      {run.startedAt ? formatDateTime(run.startedAt) : 'Queued'}
                    </Text>
                    <PosStatusPill status={run.status} />
                  </View>
                  <Text variant="caption">
                    {run.transactionsImported} imported · {run.transactionsSkipped} skipped
                    {run.errorCount > 0 ? ` · ${run.errorCount} errors` : ''}
                  </Text>
                  {run.errorMessage ? (
                    <Text className="mt-1 text-xs text-danger">{run.errorMessage}</Text>
                  ) : null}
                </Card>
              ))}
            </View>
          )}

          <Button label="Disconnect" variant="secondary" onPress={confirmDisconnect} />
        </Screen>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text variant="caption">{label}</Text>
      <Text variant="body" className="font-semibold">
        {value}
      </Text>
    </View>
  );
}
