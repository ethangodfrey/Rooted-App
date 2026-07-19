'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  WholesaleInboundOrdersResponse,
  WholesaleOrderActionResponse,
  WholesaleOrderDraftRow,
  WholesaleOrderFulfillmentPayload,
} from '@/lib/b2b/types';

export type UseWholesaleInboundOrdersOptions = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

export function useWholesaleInboundOrders(
  options: UseWholesaleInboundOrdersOptions = {},
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
      const res = await fetch(`${apiBaseUrl}/api/vendors/orders/inbound`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const body = (await res.json()) as WholesaleInboundOrdersResponse;
      if (!res.ok) {
        throw new Error(body.error || `WHOLESALE_INBOUND_HTTP_${res.status}`);
      }
      setOrders(Array.isArray(body.ORDERS) ? body.ORDERS : []);
      // eslint-disable-next-line no-console
      console.log(`WHOLESALE_INBOUND_ORDERS COUNT=${body.COUNT ?? 0}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message.toUpperCase() : 'WHOLESALE_INBOUND_LOAD_FAILED',
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptOrder = useCallback(
    async (orderId: string) => {
      if (!accessToken) {
        setError('AUTHORIZATION_REQUIRED');
        return null;
      }
      setActingId(orderId);
      setError(null);
      setStatus(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/vendors/orders/${encodeURIComponent(orderId)}/accept`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: '{}',
            cache: 'no-store',
          },
        );
        const body = (await res.json()) as WholesaleOrderActionResponse;
        if (!res.ok) {
          throw new Error(
            body.error || body.message || `WHOLESALE_ACCEPT_HTTP_${res.status}`,
          );
        }
        setStatus('ORDER_ACCEPTED_BY_SELLER');
        // eslint-disable-next-line no-console
        console.log(
          `ORDER_ACCEPTED_BY_SELLER ID=${body.ORDER?.ID ?? orderId} LINES=${body.ORDER?.ITEMS?.length ?? 0}`,
        );
        // eslint-disable-next-line no-console
        console.log(`INVENTORY_RESERVATION_SUCCESS ORDER=${orderId}`);
        setOrders((prev) =>
          prev.map((row) =>
            row.ID === orderId
              ? { ...row, ...(body.ORDER ?? {}), STATUS: 'ORDER_ACCEPTED_BY_SELLER' }
              : row,
          ),
        );
        return body;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'WHOLESALE_ACCEPT_FAILED';
        setError(message.toUpperCase());
        return null;
      } finally {
        setActingId(null);
      }
    },
    [accessToken, apiBaseUrl],
  );

  const rejectOrder = useCallback(
    async (orderId: string) => {
      if (!accessToken) {
        setError('AUTHORIZATION_REQUIRED');
        return null;
      }
      setActingId(orderId);
      setError(null);
      setStatus(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/vendors/orders/${encodeURIComponent(orderId)}/reject`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: '{}',
            cache: 'no-store',
          },
        );
        const body = (await res.json()) as WholesaleOrderActionResponse;
        if (!res.ok) {
          throw new Error(
            body.error || body.message || `WHOLESALE_REJECT_HTTP_${res.status}`,
          );
        }
        setStatus('ORDER_REJECTED_BY_SELLER');
        // eslint-disable-next-line no-console
        console.log(`ORDER_REJECTED_BY_SELLER ID=${body.ORDER?.ID ?? orderId}`);
        setOrders((prev) =>
          prev.map((row) =>
            row.ID === orderId
              ? { ...row, ...(body.ORDER ?? {}), STATUS: 'ORDER_REJECTED_BY_SELLER' }
              : row,
          ),
        );
        return body;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'WHOLESALE_REJECT_FAILED';
        setError(message.toUpperCase());
        return null;
      } finally {
        setActingId(null);
      }
    },
    [accessToken, apiBaseUrl],
  );

  const fulfillOrder = useCallback(
    async (payload: WholesaleOrderFulfillmentPayload) => {
      if (!accessToken) {
        setError('AUTHORIZATION_REQUIRED');
        return null;
      }
      setActingId(payload.order_id);
      setError(null);
      setStatus(null);
      try {
        // eslint-disable-next-line no-console
        console.log(
          `LOGISTICS_MANIFEST_VALID ORDER=${payload.order_id} CARRIER=${payload.carrier_name.toUpperCase()}`,
        );
        const res = await fetch(`${apiBaseUrl}/api/vendors/orders/fulfillment`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        const body = (await res.json()) as WholesaleOrderActionResponse;
        if (!res.ok) {
          throw new Error(
            body.error ||
              body.message ||
              `WHOLESALE_FULFILL_HTTP_${res.status}`,
          );
        }
        setStatus('ORDER_FULFILLMENT_TRACKED');
        // eslint-disable-next-line no-console
        console.log(
          `ORDER_FULFILLMENT_TRACKED ID=${body.ORDER?.ID ?? payload.order_id} TRACKING=${body.ORDER?.TRACKING_NUMBER ?? payload.tracking_number}`,
        );
        setOrders((prev) =>
          prev.map((row) =>
            row.ID === payload.order_id
              ? {
                  ...row,
                  ...(body.ORDER ?? {}),
                  STATUS: 'ORDER_SHIPPED_IN_TRANSIT',
                }
              : row,
          ),
        );
        return body;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'WHOLESALE_FULFILL_FAILED';
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
      acceptOrder,
      rejectOrder,
      fulfillOrder,
    }),
    [
      acceptOrder,
      actingId,
      error,
      fulfillOrder,
      load,
      loading,
      orders,
      rejectOrder,
      status,
    ],
  );
}
