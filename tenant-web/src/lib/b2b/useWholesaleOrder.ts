'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  assembleWholesaleOrderPayload,
  type WholesaleOrderLineInput,
} from '@/lib/b2b/order-draft';
import type {
  WholesaleOrderDraftResponse,
  WholesaleOrderDraftRow,
} from '@/lib/b2b/types';

export type UseWholesaleOrderOptions = {
  buyerVendorId?: string | null;
  sellerVendorId?: string | null;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

export type { WholesaleOrderLineInput };
export { assembleWholesaleOrderPayload };

export function useWholesaleOrder(options: UseWholesaleOrderOptions = {}) {
  const {
    buyerVendorId = null,
    sellerVendorId = null,
    accessToken = null,
    apiBaseUrl = '',
  } = options;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<WholesaleOrderDraftRow | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const canDispatch = Boolean(
    accessToken &&
      buyerVendorId &&
      sellerVendorId &&
      buyerVendorId !== sellerVendorId,
  );

  const buildPayload = useCallback(
    (lines: WholesaleOrderLineInput[]) => {
      return assembleWholesaleOrderPayload({
        buyerVendorId: buyerVendorId ?? '',
        sellerVendorId: sellerVendorId ?? '',
        lines,
      });
    },
    [buyerVendorId, sellerVendorId],
  );

  const initializeOrder = useCallback(
    async (lines: WholesaleOrderLineInput[]) => {
      setError(null);
      setStatus(null);

      if (!accessToken) {
        setError('AUTHORIZATION_REQUIRED');
        return null;
      }

      const assembled = buildPayload(lines);
      if (!assembled.valid) {
        setError(assembled.reason ?? 'WHOLESALE_PAYLOAD_INVALID');
        // eslint-disable-next-line no-console
        console.log(`WHOLESALE_PAYLOAD_INVALID REASON=${assembled.reason}`);
        return null;
      }

      setSubmitting(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/vendors/orders/drafts`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(assembled.payload),
          cache: 'no-store',
        });
        const body = (await res.json()) as WholesaleOrderDraftResponse;
        if (!res.ok) {
          const message =
            body.error ||
            body.message ||
            body.STATUS ||
            `WHOLESALE_ORDER_HTTP_${res.status}`;
          throw new Error(
            typeof message === 'string' ? message : 'WHOLESALE_ORDER_CREATE_FAILED',
          );
        }

        const nextStatus = body.STATUS || 'ORDER_DRAFT_INITIALIZED';
        setStatus(nextStatus);
        setOrder(body.ORDER ?? null);
        // eslint-disable-next-line no-console
        console.log(
          `ORDER_DRAFT_INITIALIZED ID=${body.ORDER?.ID ?? 'UNKNOWN'} LINES=${body.ORDER?.ITEMS?.length ?? 0}`,
        );
        return body;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'WHOLESALE_ORDER_CREATE_FAILED';
        setError(message.toUpperCase());
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [accessToken, apiBaseUrl, buildPayload],
  );

  return useMemo(
    () => ({
      canDispatch,
      submitting,
      error,
      status,
      order,
      buildPayload,
      initializeOrder,
    }),
    [
      buildPayload,
      canDispatch,
      error,
      initializeOrder,
      order,
      status,
      submitting,
    ],
  );
}
