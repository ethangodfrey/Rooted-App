import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { verifyHandoffCode } from '@/src/lib/handoff-api';
import { enqueueHandoff, getPendingQueueCount } from '@/src/lib/offlineQueue';
import {
  isValidPickupCode,
  maskPickupCodeInput,
  normalizePickupCode,
} from '@/src/lib/pickup-code';
import { colors } from '@/src/theme/colors';
import {
  drainHandoffQueue,
  isDeviceOnline,
  subscribeSyncWorker,
} from '@/src/workers/SyncWorker';

/**
 * Vendor quick-scanner for RT-xxx pickup tokens.
 * Offline-first: queues locally and optimistically marks COMPLETED when offline.
 * Path alias: apps/mobile/src/screens/vendor/HandoffScanner.tsx
 */
export function HandoffScanner() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'err' | 'offline'>('ok');
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const normalized = normalizePickupCode(code);
  const canSubmit = isValidPickupCode(normalized) && !busy;

  useEffect(() => {
    void getPendingQueueCount().then(setPendingCount);
    return subscribeSyncWorker((event) => {
      setPendingCount(event.remaining);
      if (event.status === 'RETRYING') {
        setSyncStatus(`RETRYING · ${event.detail ?? 'OFFLINE_QUEUE'}`);
      } else if (event.status === 'SYNC_PENDING') {
        setSyncStatus(`SYNC_PENDING · ${event.remaining}`);
      } else if (event.status === 'IDLE') {
        setSyncStatus(null);
      } else if (event.status === 'ERROR') {
        setSyncStatus(`SYNC_PENDING · ${event.detail ?? 'ERROR'}`);
      }
    });
  }, []);

  async function onVerify() {
    if (!canSubmit) {
      setFeedbackTone('err');
      setFeedback('INVALID CODE');
      setOfflineQueued(false);
      return;
    }

    setBusy(true);
    setFeedback(null);
    setOfflineQueued(false);

    try {
      const online = await isDeviceOnline();

      if (!online) {
        await enqueueHandoff(normalized);
        setPendingCount(await getPendingQueueCount());
        setFeedbackTone('offline');
        setFeedback('COMPLETE TRANSITION');
        setOfflineQueued(true);
        setCode('');
        return;
      }

      const result = await verifyHandoffCode(normalized);
      if (result.STATUS === 'SUCCESS') {
        setFeedbackTone('ok');
        setFeedback(`COMPLETE TRANSITION · ${result.CODE}`);
        setCode('');
        void drainHandoffQueue();
      } else {
        setFeedbackTone('err');
        setFeedback(result.REASON || 'INVALID_OR_ALREADY_REDEEMED');
      }
    } catch (err) {
      // Network flake mid-request: queue optimistically instead of freezing.
      await enqueueHandoff(normalized);
      setPendingCount(await getPendingQueueCount());
      setFeedbackTone('offline');
      setFeedback('COMPLETE TRANSITION');
      setOfflineQueued(true);
      setCode('');
      if (err instanceof Error && err.message) {
        setSyncStatus(`SYNC_PENDING · ${err.message.toUpperCase()}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Text
        style={{
          fontFamily: 'Courier',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 2,
          color: colors.muted,
          marginBottom: 8,
        }}>
        VERIFY TOKEN
      </Text>
      <Text variant="title" className="mb-2">
        HANDOFF SCANNER
      </Text>
      <Text
        style={{
          fontFamily: 'Courier',
          fontSize: 11,
          letterSpacing: 1,
          color: colors.muted,
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
        ENTER THE SHOPPER RT-XXX CODE TO COMPLETE TRANSITION
      </Text>

      {pendingCount > 0 || syncStatus ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#3f3f46',
            backgroundColor: '#18181b',
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginBottom: 12,
          }}>
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.2,
              color: '#a1a1aa',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}>
            {syncStatus ?? `OFFLINE_QUEUE · ${pendingCount} SYNC_PENDING`}
          </Text>
        </View>
      ) : null}

      <Card className="mb-4">
        <Input
          label="PICKUP CODE"
          value={code}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ENTER 6-CHARACTER PICKUP CODE"
          onChangeText={(next) => setCode(maskPickupCodeInput(next))}
          style={{
            fontFamily: 'Courier',
            fontSize: 22,
            letterSpacing: 3,
            fontWeight: '700',
            textAlign: 'center',
          }}
        />

        {!canSubmit && code.length > 0 ? (
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 11,
              letterSpacing: 1,
              color: '#B91C1C',
              marginBottom: 10,
              textTransform: 'uppercase',
            }}>
            INVALID CODE · EXPECT RT-XXX
          </Text>
        ) : null}

        <Button
          label={busy ? 'VERIFYING' : '[ VERIFY & EXECUTE HAND-OFF ]'}
          loading={busy}
          disabled={!canSubmit}
          onPress={() => void onVerify()}
        />
      </Card>

      {feedback ? (
        <View
          style={{
            borderWidth: 1,
            borderColor:
              feedbackTone === 'err'
                ? '#B91C1C'
                : feedbackTone === 'offline'
                  ? '#52525b'
                  : '#18181b',
            backgroundColor:
              feedbackTone === 'err'
                ? '#FEF2F2'
                : feedbackTone === 'offline'
                  ? '#27272a'
                  : '#09090b',
            padding: 14,
          }}>
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1.2,
              color:
                feedbackTone === 'err'
                  ? '#B91C1C'
                  : feedbackTone === 'offline'
                    ? '#d4d4d8'
                    : '#fafafa',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}>
            {feedback}
          </Text>
          {offlineQueued ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: 'Courier',
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1,
                color: '#a1a1aa',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}>
              OFFLINE MODE — TRANSACTION QUEUED LOCALLY
            </Text>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
