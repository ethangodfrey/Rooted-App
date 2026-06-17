import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { formatEventFullDate, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperReservePage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [options, setOptions] = useState<{ available_quantity_presale: number; event: { id: string; name: string; start_datetime: string; city: string | null } | null }[]>([]);
  const [eventId, setEventId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [productRes, availRes] = await Promise.all([
        supabase.from('products').select('id, name, price, reserve_enabled').eq('id', productId).maybeSingle(),
        supabase.from('product_event_availability').select('available_quantity_presale, event:events(id, name, start_datetime, city, state)').eq('product_id', productId).gt('available_quantity_presale', 0),
      ]);
      setProduct(productRes.data);
      const opts = (availRes.data as unknown as typeof options) ?? [];
      setOptions(opts);
      if (opts.length === 1 && opts[0].event) setEventId(opts[0].event.id);
      setLoading(false);
    }
    load();
  }, [productId]);

  async function handleSubmit() {
    if (!eventId) {
      setError('Select an event for pickup.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_reservation', {
      p_product_id: productId,
      p_event_id: eventId,
      p_quantity: quantity,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    navigate(`/shopper/orders/${data as string}`);
  }

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!product) return <div className="app-empty">Product not found.</div>;

  const total = product.price * quantity;

  return (
    <div className="app-screen app-screen--narrow">
      <Link to={`/shopper/products/${productId}`} className="app-back-link">← Back</Link>
      <h1 className="app-title">Reserve for pickup</h1>
      <p className="app-subtitle">{product.name} · {formatPrice(product.price)} each</p>

      <div className="app-input-group">
        <label htmlFor="event">Pickup event</label>
        <select id="event" className="app-select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Select event</option>
          {options.map((opt) => (
            <option key={opt.event?.id} value={opt.event?.id}>
              {opt.event?.name} — {opt.event ? formatEventFullDate(opt.event.start_datetime) : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="app-input-group">
        <label htmlFor="qty">Quantity</label>
        <input id="qty" className="app-input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
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
