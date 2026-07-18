import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';

type PreorderReceipt = {
  id: string;
  pickup_code: string;
  status: string;
  payment_status: string;
  total_amount: number;
  fulfillment_label: string | null;
  created_at: string;
};

/**
 * High-contrast digital pass for PENDING_PICKUP pre-orders.
 * Path alias: apps/mobile/src/screens/shopper/ReceiptScreen.tsx
 */
export function ReceiptScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PreorderReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('preorder_orders')
        .select(
          'id, pickup_code, status, payment_status, total_amount, fulfillment_label, created_at',
        )
        .eq('shopper_id', user.id)
        .eq('status', 'PENDING_PICKUP')
        .order('created_at', { ascending: false });

      if (queryError) throw new Error(queryError.message);
      setRows(
        ((data ?? []) as PreorderReceipt[]).map((row) => ({
          ...row,
          total_amount: Number(row.total_amount),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RECEIPT_LOAD_FAILED');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && rows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <LoadingIndicator />
      </View>
    );
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
        RECEIPT
      </Text>
      <Text variant="title" className="mb-2">
        PENDING PICKUP
      </Text>
      <View className="mb-4">
        <Button
          label="[ REFRESH PASS ]"
          variant="secondary"
          loading={loading}
          onPress={() => void load()}
        />
      </View>

      {error ? (
        <Text
          style={{
            fontFamily: 'Courier',
            fontSize: 11,
            letterSpacing: 1,
            color: '#B91C1C',
            marginBottom: 12,
            textTransform: 'uppercase',
          }}>
          {error}
        </Text>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              textAlign: 'center',
              color: colors.muted,
            }}>
            NO PENDING HANDOFF PASSES
          </Text>
        </Card>
      ) : (
        rows.map((order) => (
          <Card key={order.id} className="mb-4" style={{ backgroundColor: '#09090b' }}>
            <Text
              style={{
                fontFamily: 'Courier',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2,
                color: '#71717a',
                textAlign: 'center',
                marginBottom: 12,
              }}>
              PICKUP TOKEN
            </Text>
            <Text
              style={{
                fontFamily: 'Courier',
                fontSize: 36,
                fontWeight: '800',
                letterSpacing: 4,
                color: '#fafafa',
                textAlign: 'center',
                marginBottom: 16,
              }}>
              {`CODE: ${order.pickup_code}`}
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#fafafa',
                backgroundColor: '#fafafa',
                paddingVertical: 10,
                paddingHorizontal: 12,
                marginBottom: 14,
              }}>
              <Text
                style={{
                  fontFamily: 'Courier',
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.2,
                  color: '#09090b',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}>
                PRESENT THIS CODE TO PRODUCER AT HANDOFF
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Courier',
                fontSize: 10,
                letterSpacing: 1,
                color: '#a1a1aa',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}>
              {order.payment_status} · {formatPrice(order.total_amount)}
              {order.fulfillment_label ? ` · ${order.fulfillment_label}` : ''}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
