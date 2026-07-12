import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
} from '@/components/vendor/vendor-ui';
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
      if (!vendor) {
        setLoading(false);
        return;
      }
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
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
      <VendorHero eyebrow="Vendor" title="Log in-person sale" />

      <VendorFormPanel>
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
          <div className="mt-4 rounded-lg border border-stone-200/40 bg-stone-50/80 p-3">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">Sale total</p>
            <p className="m-0 mt-1 text-lg font-bold text-stone-800">{formatPrice(total)}</p>
          </div>
        ) : null}

        {error ? <p className="app-error">{error}</p> : null}
        {success ? <p className="m-0 text-sm text-emerald-700">Sale logged.</p> : null}

        <VendorPrimaryButton className="mt-4 w-full" disabled={saving} onClick={() => void handleLog()}>
          {saving ? 'Saving…' : 'Log sale'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
