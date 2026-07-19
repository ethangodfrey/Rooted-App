'use client';

import { useState, type FormEvent } from 'react';

import type { WholesaleOrderFulfillmentPayload } from '@/lib/b2b/types';

export type WholesaleShippingManifestProps = {
  orderId: string;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (payload: WholesaleOrderFulfillmentPayload) => Promise<unknown>;
};

function toIsoTimestamp(localValue: string): string {
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return localValue;
  return parsed.toISOString();
}

export function WholesaleShippingManifest({
  orderId,
  disabled = false,
  submitting = false,
  onSubmit,
}: WholesaleShippingManifestProps) {
  const [carrierName, setCarrierName] = useState('FedEx');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const carrier = carrierName.trim();
    const tracking = trackingNumber.trim();
    if (!carrier || !tracking || !estimatedDeliveryAt.trim()) {
      setLocalError('LOGISTICS_MANIFEST_INVALID');
      return;
    }

    const payload: WholesaleOrderFulfillmentPayload = {
      order_id: orderId,
      carrier_name: carrier,
      tracking_number: tracking,
      estimated_delivery_at: toIsoTimestamp(estimatedDeliveryAt),
    };

    await onSubmit(payload);
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="mt-5 space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-4"
      data-testid={`shipping-manifest-${orderId}`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
        SHIPPING MANIFEST — ORDER_ACCEPTED_BY_SELLER
      </p>
      <p className="text-xs text-white/60">
        Capture carrier details to move this order into ORDER_SHIPPED_IN_TRANSIT.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[11px] font-mono uppercase tracking-widest text-white/55">
          Carrier Name
          <input
            type="text"
            value={carrierName}
            onChange={(event) => setCarrierName(event.target.value)}
            disabled={disabled || submitting}
            list={`carrier-options-${orderId}`}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm normal-case tracking-normal text-zinc-50"
            placeholder="FedEx"
            required
          />
          <datalist id={`carrier-options-${orderId}`}>
            <option value="FedEx" />
            <option value="UPS" />
            <option value="Freight Carrier" />
            <option value="USPS" />
          </datalist>
        </label>

        <label className="block text-[11px] font-mono uppercase tracking-widest text-white/55">
          Tracking Number
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            disabled={disabled || submitting}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm normal-case tracking-normal text-zinc-50"
            placeholder="1Z..."
            required
          />
        </label>

        <label className="block text-[11px] font-mono uppercase tracking-widest text-white/55">
          Estimated Delivery
          <input
            type="datetime-local"
            value={estimatedDeliveryAt}
            onChange={(event) => setEstimatedDeliveryAt(event.target.value)}
            disabled={disabled || submitting}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm normal-case tracking-normal text-zinc-50"
            required
          />
        </label>
      </div>

      {localError ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
          {localError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || submitting}
        className="inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        data-testid={`fulfill-order-${orderId}`}
      >
        {submitting ? 'TRACKING_SHIPMENT' : 'MARK AS SHIPPED'}
      </button>
    </form>
  );
}
