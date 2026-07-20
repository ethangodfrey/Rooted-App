import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { createCheckout } from '@/lib/checkout-api';
import { useNow } from '@/hooks/use-now';
import { formatEventDisplayFullDate, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type ReserveField = 'eventId' | 'quantity';

export function ShopperReservePage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const now = useNow(60_000);
  const [product, setProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [options, setOptions] = useState<{
    available_quantity_presale: number;
    event: {
      id: string;
      name: string;
      start_datetime: string;
      end_datetime?: string | null;
      timezone?: string | null;
      hours_summary?: string | null;
      sync_metadata?: Record<string, unknown>;
      city: string | null;
      state?: string | null;
    } | null;
  }[]>([]);
  const [eventId, setEventId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReserveField, string>>>({});

  useEffect(() => {
    async function load() {
      const [productRes, availRes] = await Promise.all([
        supabase.from('products').select('id, name, price, reserve_enabled').eq('id', productId).maybeSingle(),
        supabase.from('product_event_availability').select('available_quantity_presale, event:events(id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, city, state)').eq('product_id', productId).gt('available_quantity_presale', 0),
      ]);
      setProduct(productRes.data);
      const opts = (availRes.data as unknown as typeof options) ?? [];
      setOptions(opts);
      if (opts.length === 1 && opts[0].event) setEventId(opts[0].event.id);
      setLoading(false);
    }
    load();
  }, [productId]);

  function clearFieldError(field: ReserveField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit() {
    const nextFieldErrors: Partial<Record<ReserveField, string>> = {};

    if (!eventId) {
      nextFieldErrors.eventId = 'Select an event for pickup.';
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      nextFieldErrors.quantity = 'Quantity must be at least 1.';
    } else {
      const selected = options.find((opt) => opt.event?.id === eventId);
      if (selected && quantity > selected.available_quantity_presale) {
        nextFieldErrors.quantity = `Only ${selected.available_quantity_presale} available for this event.`;
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCheckout([
        {
          productId: productId!,
          eventId,
          quantity,
          notes: notes.trim() || undefined,
        },
      ]);
      navigate(`/checkout/success?transactionId=${result.transactionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="app-screen app-screen--narrow" aria-busy aria-label="Loading reservation">
        <Skeleton style={{ width: 96, height: 16, marginBottom: 16 }} />
        <SkeletonText width="70%" height={28} />
        <SkeletonText width="45%" height={16} />
        <div className="mt-6 flex flex-col gap-4">
          <Skeleton style={{ height: 48, width: '100%' }} />
          <Skeleton style={{ height: 48, width: '100%' }} />
          <Skeleton style={{ height: 88, width: '100%' }} />
        </div>
      </div>
    );
  }
  if (!product) return <div className="app-empty">Product not found.</div>;

  const total = product.price * quantity;

  return (
    <div className="app-screen app-screen--narrow">
      <Link to={`/shopper/products/${productId}`} className="app-back-link">← Back</Link>
      <h1 className="app-title">Reserve for pickup</h1>
      <p className="app-subtitle">{product.name} · {formatPrice(product.price)} each</p>

      <div className="app-input-group">
        <label htmlFor="event">Pickup event</label>
        <select
          id="event"
          className={`app-select${fieldErrors.eventId ? ' app-input--invalid' : ''}`}
          value={eventId}
          aria-invalid={Boolean(fieldErrors.eventId)}
          onChange={(e) => {
            setEventId(e.target.value);
            clearFieldError('eventId');
          }}
        >
          <option value="">Select event</option>
          {options.map((opt) => (
            <option key={opt.event?.id} value={opt.event?.id}>
              {opt.event?.name} — {opt.event ? formatEventDisplayFullDate(opt.event, now) : ''}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.eventId} />
      </div>

      <div className="app-input-group">
        <label htmlFor="qty">Quantity</label>
        <input
          id="qty"
          className={`app-input${fieldErrors.quantity ? ' app-input--invalid' : ''}`}
          type="number"
          min={1}
          value={quantity}
          aria-invalid={Boolean(fieldErrors.quantity)}
          onChange={(e) => {
            setQuantity(Number(e.target.value));
            clearFieldError('quantity');
          }}
        />
        <FieldError message={fieldErrors.quantity} />
      </div>

      <div className="app-input-group">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" className="app-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
        <p className="app-row-title">Total: {formatPrice(total)}</p>
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Submitting…' : 'Place reservation'}
      </button>
    </div>
  );
}
