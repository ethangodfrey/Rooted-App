import './cart-checkout-slider.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { formatPrice } from '@/lib/format';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { initiateStorefrontCheckout, reserveCartLine } from '@/lib/storefront-checkout';
import {
  cartLineCount,
  cartSubtotal,
  clearStorefrontCart,
  type StorefrontCart,
} from '@/lib/storefront-cart';
import { supabase } from '@/lib/supabase';

export interface CartCheckoutSliderProps {
  cart: StorefrontCart;
  open: boolean;
  onClose: () => void;
  onCartChange: (cart: StorefrontCart) => void;
}

interface EventOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

/**
 * Mobile-optimized bottom-sheet checkout slider.
 *
 * Flow:
 * 1. Shopper picks an event (market day) for pickup
 * 2. Each line gets an inventory hold via reserve_inventory RPC
 * 3. POST /api/checkout/initiate validates presale + POS stock, creates order,
 *    and enqueues BullMQ online-sale-deduct jobs for live dashboard sync
 */
export function CartCheckoutSlider({ cart, open, onClose, onCartChange }: CartCheckoutSliderProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState(cart.eventId ?? '');
  const [notes, setNotes] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineCount = useMemo(() => cartLineCount(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  useEffect(() => {
    if (!open) return;

    async function loadEvents() {
      setLoadingEvents(true);
      const productIds = cart.lines.map((l) => l.productId);
      if (productIds.length === 0) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const { data } = await supabase
        .from('product_event_availability')
        .select('event_id, events(id, name, city, state)')
        .in('product_id', productIds);

      const map = new Map<string, EventOption>();
      for (const row of data ?? []) {
        const raw = row.events as EventOption | EventOption[] | null;
        const event = Array.isArray(raw) ? raw[0] : raw;
        if (event?.id) map.set(event.id, event);
      }
      const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      setEvents(list);
      if (!eventId && list[0]) setEventId(list[0].id);
      setLoadingEvents(false);
    }

    void loadEvents();
  }, [open, cart.lines, eventId]);

  const ensureHolds = useCallback(async (): Promise<StorefrontCart> => {
    if (!eventId) throw new Error('Select a pickup event');

    let next = { ...cart, eventId, eventName: events.find((e) => e.id === eventId)?.name ?? null };
    const updatedLines = [];

    for (const line of next.lines) {
      if (line.holdId) {
        updatedLines.push(line);
        continue;
      }
      const hold = await reserveCartLine(line.productId, eventId, line.quantity);
      if (!hold.holdId) throw new Error(hold.error ?? `Could not reserve ${line.name}`);
      updatedLines.push({ ...line, holdId: hold.holdId });
    }

    next = { ...next, lines: updatedLines };
    onCartChange(next);
    return next;
  }, [cart, eventId, events, onCartChange]);

  async function handleCheckout(paymentMethod: 'reserve' | 'stripe') {
    setSubmitting(true);
    setError(null);
    try {
      const readyCart = await ensureHolds();
      const result = await initiateStorefrontCheckout({
        vendorId: readyCart.vendorId,
        eventId: eventId,
        notes: notes.trim() || undefined,
        paymentMethod,
        items: readyCart.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          holdId: line.holdId,
        })),
      });

      clearStorefrontCart(readyCart.vendorId);
      onClose();

      if (result.payment.checkoutUrl) {
        window.location.href = result.payment.checkoutUrl;
        return;
      }

      navigate(`/shopper/orders/${result.orderId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close cart"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative max-h-[90vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Cart</p>
            <h2 className="text-lg font-semibold text-slate-900">{cart.vendorName}</h2>
            <p className="text-sm text-slate-500">
              {lineCount} item{lineCount === 1 ? '' : 's'} · {formatPrice(subtotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(90vh - 12rem)' }}>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Pickup event</span>
            {loadingEvents ? (
              <p className="text-sm text-slate-500">Loading events…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-amber-700">No upcoming events for these products.</p>
            ) : (
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                    {event.city ? ` · ${event.city}` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          <ul className="mb-4 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100">
            {cart.lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 px-4 py-3">
                <FallbackImage
                  src={line.mediaUrl}
                  variant="product"
                  label={line.name}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{line.name}</p>
                  <p className="text-sm text-slate-500">
                    Qty {line.quantity} · {formatPrice(line.price * line.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <label className="mb-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="Allergies, pickup timing, etc."
            />
          </label>

          {error ? (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-slate-500">
            Checkout validates presale and POS in-person stock, then syncs deductions through our
            inventory queue so Square/Toast registers stay aligned.
          </p>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <span className="text-xl font-semibold text-slate-900">{formatPrice(subtotal)}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={submitting || !eventId || cart.lines.length === 0}
              onClick={() => void handleCheckout('reserve')}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Processing…' : 'Reserve & pay at pickup'}
            </button>
            <button
              type="button"
              disabled={submitting || !eventId || cart.lines.length === 0}
              onClick={() => void handleCheckout('stripe')}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              Pay online
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
