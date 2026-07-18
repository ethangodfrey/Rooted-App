import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { verifyHandoffCode } from '@/src/lib/handoff-api';
import {
  isValidPickupCode,
  maskPickupCodeInput,
  normalizePickupCode,
} from '@/src/lib/pickup-code';
import { colors } from '@/src/theme/colors';

/**
 * Vendor quick-scanner for RT-xxx pickup tokens.
 * Path alias: apps/mobile/src/screens/vendor/HandoffScanner.tsx
 */
export function HandoffScanner() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'err'>('ok');

  const normalized = normalizePickupCode(code);
  const canSubmit = isValidPickupCode(normalized) && !busy;

  async function onVerify() {
    if (!canSubmit) {
      setFeedbackTone('err');
      setFeedback('INVALID CODE');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await verifyHandoffCode(normalized);
      if (result.STATUS === 'SUCCESS') {
        setFeedbackTone('ok');
        setFeedback(`COMPLETE TRANSITION · ${result.CODE}`);
        setCode('');
      } else {
        setFeedbackTone('err');
        setFeedback(result.REASON || 'INVALID_OR_ALREADY_REDEEMED');
      }
    } catch (err) {
      setFeedbackTone('err');
      setFeedback(err instanceof Error ? err.message.toUpperCase() : 'INVALID CODE');
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
            borderColor: feedbackTone === 'ok' ? '#18181b' : '#B91C1C',
            backgroundColor: feedbackTone === 'ok' ? '#09090b' : '#FEF2F2',
            padding: 14,
          }}>
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1.2,
              color: feedbackTone === 'ok' ? '#fafafa' : '#B91C1C',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}>
            {feedback}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
