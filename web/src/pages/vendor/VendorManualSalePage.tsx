import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface EventOption {
  id: string;
  name: string;
}

export function VendorManualSalePage() {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [productId, setProductId] = useState('');
  const [eventId, setEventId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!vendor) return;
      const [productsRes, eventsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, price')
          .eq('vendor_id', vendor.id)
          .eq('status', 'active'),
        supabase.from('vendor_events').select('event:events(id, name)').eq('vendor_id', vendor.id),
      ]);
      setProducts((productsRes.data as ProductOption[]) ?? []);
      const evRows =
        (eventsRes.data as unknown as { event: { id: string; name: string } | null }[]) ?? [];
      setEvents(evRows.filter((r) => r.event).map((r) => r.event!));
      setLoading(false);
    }
    load();
  }, [vendor]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const total = selectedProduct ? selectedProduct.price * quantity : 0;

  async function handleLog() {
    if (!vendor) return;
    if (!productId) {
      setError('Select a product.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { error: insertError } = await supabase.from('inventory_transactions').insert({
      vendor_id: vendor.id,
      product_id: productId,
      event_id: eventId || null,
      transaction_type: 'sale_manual',
      quantity_change: -quantity,
      source: 'web_manual',
      notes: notes.trim() || null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    setQuantity(1);
    setNotes('');
  }

  if (loading) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">Log in-person sale</h1>
      <p className="app-subtitle">Record cash or card sales at your booth for analytics.</p>

      <div className="app-input-group">
        <label>Product</label>
        <select className="app-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({formatPrice(p.price)})
            </option>
          ))}
        </select>
      </div>

      <div className="app-input-group">
        <label>Event (optional)</label>
        <select className="app-input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">No specific event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="app-input-group">
        <label>Quantity</label>
        <input
          className="app-input"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      <div className="app-input-group">
        <label>Notes (optional)</label>
        <textarea className="app-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {selectedProduct ? (
        <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
          <p className="app-row-meta">Sale total</p>
          <p className="app-row-title">{formatPrice(total)}</p>
        </div>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}
      {success ? <p className="app-row-meta" style={{ color: 'var(--color-forest)' }}>Sale logged.</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={saving} onClick={() => void handleLog()}>
        {saving ? 'Saving…' : 'Log sale'}
      </button>
    </div>
  );
}
