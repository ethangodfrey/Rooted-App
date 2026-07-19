import { useCallback, useMemo, useState } from 'react';

import {
  assembleWholesaleOrderPayload,
  type WholesaleOrderLineInput,
} from '@/src/lib/b2b/order-draft';
import { createWholesaleOrderDraft } from '@/src/lib/b2b/wholesale-api';
import type { WholesaleOrderDraftRow } from '@/src/lib/b2b/types';

export type UseWholesaleOrderOptions = {
  buyerVendorId?: string | null;
  sellerVendorId?: string | null;
};

export type { WholesaleOrderLineInput };
export { assembleWholesaleOrderPayload };

/**
 * Mobile mirror of tenant-web useWholesaleOrder — draft assembly + Nest POST.
 * Generates the same snake_case payload that seeds wholesale_invoices downstream.
 */
export function useWholesaleOrder(options: UseWholesaleOrderOptions = {}) {
  const { buyerVendorId = null, sellerVendorId = null } = options;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<WholesaleOrderDraftRow | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const canDispatch = Boolean(
    buyerVendorId && sellerVendorId && buyerVendorId !== sellerVendorId,
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

      const assembled = buildPayload(lines);
      if (!assembled.valid) {
        setError(assembled.reason ?? 'WHOLESALE_PAYLOAD_INVALID');
        // eslint-disable-next-line no-console
        console.log(`WHOLESALE_PAYLOAD_INVALID REASON=${assembled.reason}`);
        return null;
      }

      setSubmitting(true);
      try {
        const body = await createWholesaleOrderDraft(assembled.payload);
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
    [buildPayload],
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
    [buildPayload, canDispatch, error, initializeOrder, order, status, submitting],
  );
}
