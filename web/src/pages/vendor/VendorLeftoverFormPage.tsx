import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { expiresAtFromHours, EXPIRY_PRESETS } from '@/lib/leftovers';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface ProductOption {
  id: string;
  name: string;
  price: number;
  media_urls: string[];
}

interface EventOption {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
}

type PickupMode = 'vendor_area' | 'event';

export function VendorLeftoverFormPage() {
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [sourceEventId, setSourceEventId] = useState<string | null>(null);
  const [pickupMode, setPickupMode] = useState<PickupMode>('vendor_area');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryHours, setExpiryHours] = useState(12);
  const [pickupNotes, setPickupNotes] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    Promise.all([
      supabase
        .from('products')
        .select('id, name, price, media_urls')
        .eq('vendor_id', vendor.id)
        .eq('status', 'active'),
      supabase
        .from('vendor_events')
        .select('event:events(id, name, address, city, state, latitude, longitude)')
        .eq('vendor_id', vendor.id),
    ]).then(([productsRes, eventsRes]) => {
      setProducts((productsRes.data as ProductOption[]) ?? []);
      const rows = (eventsRes.data as unknown as { event: EventOption | null }[]) ?? [];
      setEvents(rows.filter((r) => r.event).map((r) => r.event!));
    });
  }, [vendor]);

  function selectProduct(id: string | null) {
    setProductId(id);
    if (!id) return;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setTitle(product.name);
    setPriceDollars((product.price / 100).toFixed(2));
    if (product.media_urls?.[0]) setMediaUrl(product.media_urls[0]);
  }

  async function handlePublish() {
    if (!vendor) return;
    const qty = Number.parseInt(quantity, 10);
    const priceCents = Math.round(Number.parseFloat(priceDollars) * 100);
    if (!title.trim()) {
      setError('Add a title for this leftover.');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Quantity must be at least 1.');
      return;
    }

    const event = sourceEventId ? events.find((e) => e.id === sourceEventId) : null;
    let pickupCity = vendor.sell_city;
    let pickupState = vendor.sell_state;
    let pickupAddress: string | null = null;
    let pickupLat: number | null = null;
    let pickupLng: number | null = null;

    if (pickupMode === 'event' && event) {
      pickupCity = event.city;
      pickupState = event.state;
      pickupAddress = event.address;
      pickupLat = Number(event.latitude);
      pickupLng = Number(event.longitude);
    } else if (pickupMode === 'event' && !sourceEventId) {
      setError('Select which market this leftover is from.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('leftover_listings').insert({
      vendor_id: vendor.id,
      product_id: productId,
      source_event_id: sourceEventId,
      title: title.trim(),
      description: description.trim() || null,
      media_url: mediaUrl,
      price_cents: priceCents,
      quantity_total: qty,
      quantity_remaining: qty,
      expires_at: expiresAtFromHours(expiryHours),
      pickup_address: pickupAddress,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      pickup_latitude: pickupLat,
      pickup_longitude: pickupLng,
      pickup_notes: pickupNotes.trim() || null,
      status: 'active',
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    navigate('/vendor/leftovers');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/vendor/leftovers" className="app-back-link">← Leftovers</Link>
      <h1 className="app-title">List leftovers</h1>
      <p className="app-row-meta" style={{ marginBottom: '1rem' }}>
        Post unsold items after a market. Shoppers nearby see deals sorted by time left and pickup location.
      </p>

      {products.length > 0 ? (
        <div className="app-input-group">
          <label>From catalog (optional)</label>
          <div className="app-chip-row">
            <button type="button" className={`app-chip${productId === null ? ' app-chip--selected' : ''}`} onClick={() => selectProduct(null)}>
              Custom
            </button>
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`app-chip${productId === p.id ? ' app-chip--selected' : ''}`}
                onClick={() => selectProduct(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="app-input-group">
        <label>Title</label>
        <input className="app-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="app-input-group">
        <label>Description</label>
        <textarea
          className="app-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's left, condition, pickup instructions..."
          rows={3}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="app-input-group">
          <label>Price ($)</label>
          <input className="app-input" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} inputMode="decimal" />
        </div>
        <div className="app-input-group">
          <label>Quantity</label>
          <input className="app-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <div className="app-input-group">
        <label>Available for</label>
        <div className="app-chip-row">
          {EXPIRY_PRESETS.map((preset) => (
            <button
              key={preset.hours}
              type="button"
              className={`app-chip${expiryHours === preset.hours ? ' app-chip--selected' : ''}`}
              onClick={() => setExpiryHours(preset.hours)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-input-group">
        <label>Pickup location</label>
        <div className="app-chip-row">
          <button
            type="button"
            className={`app-chip${pickupMode === 'vendor_area' ? ' app-chip--selected' : ''}`}
            onClick={() => setPickupMode('vendor_area')}
          >
            My area
          </button>
          <button
            type="button"
            className={`app-chip${pickupMode === 'event' ? ' app-chip--selected' : ''}`}
            onClick={() => setPickupMode('event')}
            disabled={events.length === 0}
          >
            From market
          </button>
        </div>
      </div>

      {pickupMode === 'event' && events.length > 0 ? (
        <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`app-chip${sourceEventId === event.id ? ' app-chip--selected' : ''}`}
              onClick={() => setSourceEventId(event.id)}
            >
              {event.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="app-card" style={{ marginBottom: '1rem' }}>
          <p className="app-row-meta">
            Pickup near {vendor?.sell_city ?? 'your city'}, {vendor?.sell_state ?? 'your state'}
          </p>
        </div>
      )}

      <div className="app-input-group">
        <label>Pickup notes (optional)</label>
        <textarea
          className="app-textarea"
          value={pickupNotes}
          onChange={(e) => setPickupNotes(e.target.value)}
          placeholder="e.g. Text when you arrive, porch pickup..."
          rows={2}
        />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={saving} onClick={handlePublish}>
        {saving ? 'Publishing…' : 'Publish leftover'}
      </button>
    </div>
  );
}
