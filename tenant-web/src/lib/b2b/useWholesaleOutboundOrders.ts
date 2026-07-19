'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  WholesaleOrderDraftRow,
  WholesaleOrderSettlementPayload,
  WholesaleOrderSettlementResponse,
  WholesaleOutboundOrdersResponse,
} from '@/lib/b2b/types';

export type UseWholesaleOutboundOrdersOptions = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

export function useWholesaleOutboundOrders(
  options: UseWholesaleOutboundOrdersOptions = {},
) {
  const { accessToken = null, apiBaseUrl = '' } = options;
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [orders, setOrders] = useState<WholesaleOrderDraftRow[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendors/orders/outbound`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const body = (await res.json()) as WholesaleOutboundOrdersResponse;
      if (!res.ok) {
        throw new Error(body.error || `WHOLESALE_OUTBOUND_HTTP_${res.status}`);
      }
      setOrders(Array.isArray(body.ORDERS) ? body.ORDERS : []);
      // eslint-disable-next-line no-console
      console.log(`WHOLESALE_OUTBOUND_ORDERS COUNT=${body.COUNT ?? 0}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'WHOLESALE_OUTBOUND_LOAD_FAILED',
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelivery = useCallback(
    async (payload: WholesaleOrderSettlementPayload) => {
      if (!accessToken) {
        setError('AUTHORIZATION_REQUIRED');
        return null;
      }
      setActingId(payload.order_id);
      setError(null);
      setStatus(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/vendors/orders/settlement`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        const body = (await res.json()) as WholesaleOrderSettlementResponse;
        if (!res.ok) {
          throw new Error(
            body.error ||
              body.message ||
              `WHOLESALE_SETTLEMENT_HTTP_${res.status}`,
          );
        }
        setStatus('ORDER_DELIVERY_CONFIRMED');
        // eslint-disable-next-line no-console
        console.log(
          `ORDER_DELIVERY_CONFIRMED ID=${body.ORDER?.ID ?? payload.order_id} DELIVERED_AT=${payload.delivered_at}`,
        );
        // eslint-disable-next-line no-console
        console.log(
          `WHOLESALE_LEDGER_SETTLED ORDER=${body.ORDER?.ID ?? payload.order_id} LEDGER=${body.LEDGER ?? 'WHOLESALE_LEDGER_SETTLED'}`,
        );
        if (body.INVOICE?.ID) {
          // eslint-disable-next-line no-console
          console.log(
            `WHOLESALE_INVOICE_GENERATED ID=${body.INVOICE.ID} NUMBER=${body.INVOICE.INVOICE_NUMBER} DUE_AT=${body.INVOICE.DUE_AT}`,
          );
          // eslint-disable-next-line no-console
          console.log(
            `BILLING_LEDGER_UPDATED INVOICE=${body.INVOICE.ID} BILLING=${body.BILLING ?? 'BILLING_LEDGER_UPDATED'}`,
          );
        }
        setOrders((prev) =>
          prev.map((row) =>
            row.ID === payload.order_id
              ? {
                  ...row,
                  ...(body.ORDER ?? {}),
                  STATUS: 'ORDER_DELIVERY_CONFIRMED',
                  INVOICE_ID: body.INVOICE?.ID ?? body.ORDER?.INVOICE_ID ?? null,
                  INVOICE_NUMBER:
                    body.INVOICE?.INVOICE_NUMBER ??
                    body.ORDER?.INVOICE_NUMBER ??
                    null,
                }
              : row,
          ),
        );
        return body;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'WHOLESALE_SETTLEMENT_FAILED';
        setError(message.toUpperCase());
        return null;
      } finally {
        setActingId(null);
      }
    },
    [accessToken, apiBaseUrl],
  );

  return useMemo(
    () => ({
      loading,
      actingId,
      error,
      status,
      orders,
      reload: load,
      confirmDelivery,
    }),
    [actingId, confirmDelivery, error, load, loading, orders, status],
  );
}
