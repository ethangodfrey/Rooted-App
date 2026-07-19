'use client';

import { useState, type FormEvent } from 'react';

import type { WholesaleOrderSettlementPayload } from '@/lib/b2b/types';

export type WholesaleDeliveryConfirmProps = {
  orderId: string;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (payload: WholesaleOrderSettlementPayload) => Promise<unknown>;
};

function toIsoTimestamp(localValue: string): string {
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return localValue;
  return parsed.toISOString();
}

function defaultLocalNow(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function WholesaleDeliveryConfirm({
  orderId,
  disabled = false,
  submitting = false,
  onSubmit,
}: WholesaleDeliveryConfirmProps) {
  const [deliveredAt, setDeliveredAt] = useState(defaultLocalNow);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!deliveredAt.trim()) {
      setLocalError('SETTLEMENT_VALIDATION_ERROR: DELIVERED_AT REQUIRED');
      return;
    }
    await onSubmit({
      order_id: orderId,
      delivered_at: toIsoTimestamp(deliveredAt),
    });
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="mt-5 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4"
      data-testid={`delivery-confirm-${orderId}`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
        MARK RECEIVED — ORDER_SHIPPED_IN_TRANSIT
      </p>
      <p className="text-xs text-white/60">
        Confirm delivery receipt to finalize settlement as ORDER_DELIVERY_CONFIRMED.
      </p>

      <label className="block max-w-sm text-[11px] font-mono uppercase tracking-widest text-white/55">
        Delivered At
        <input
          type="datetime-local"
          value={deliveredAt}
          onChange={(event) => setDeliveredAt(event.target.value)}
          disabled={disabled || submitting}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm normal-case tracking-normal text-zinc-50"
          required
        />
      </label>

      {localError ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
          {localError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || submitting}
        className="inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        data-testid={`mark-received-${orderId}`}
      >
        {submitting ? 'SETTLING_LEDGER' : 'MARK RECEIVED'}
      </button>
    </form>
  );
}
