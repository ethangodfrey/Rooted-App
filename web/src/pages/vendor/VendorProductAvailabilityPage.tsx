import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatEventDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface AttendedEvent {
  id: string;
  name: string;
  start_datetime: string;
}

interface QtyEntry {
  presale: string;
  inperson: string;
}

export function VendorProductAvailabilityPage() {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const [events, setEvents] = useState<AttendedEvent[]>([]);
  const [quantities, setQuantities] = useState<Record<string, QtyEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor || !productId) return;
    setError(null);

    const [participationRes, availabilityRes] = await Promise.all([
      supabase
        .from('vendor_events')
        .select('events!inner(id, name, start_datetime)')
        .eq('vendor_id', vendor.id),
      supabase
        .from('product_event_availability')
        .select('event_id, available_quantity_presale, available_quantity_inperson')
        .eq('product_id', productId),
    ]);

    if (participationRes.error) {
      setError(participationRes.error.message);
      setLoading(false);
      return;
    }

    const attended: AttendedEvent[] = (participationRes.data ?? [])
      .map((row) => {
        const ev = (row as { events: AttendedEvent | AttendedEvent[] }).events;
        return Array.isArray(ev) ? ev[0] : ev;
      })
      .filter((ev): ev is AttendedEvent => Boolean(ev))
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

    const existing: Record<string, QtyEntry> = {};
    for (const ev of attended) {
      existing[ev.id] = { presale: '0', inperson: '0' };
    }
    for (const row of availabilityRes.data ?? []) {
      const eid = row.event_id as string;
      existing[eid] = {
        presale: String(row.available_quantity_presale ?? 0),
        inperson: String(row.available_quantity_inperson ?? 0),
      };
    }

    setEvents(attended);
    setQuantities(existing);
    setLoading(false);
  }, [vendor, productId]);

  useEffect(() => {
    load();
  }, [load]);

  function setQty(eventId: string, field: keyof QtyEntry, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], [field]: value.replace(/[^0-9]/g, '') },
    }));
  }

  async function handleSave() {
    if (!productId) return;
    setError(null);

    const rows = events.map((ev) => {
      const entry = quantities[ev.id] ?? { presale: '0', inperson: '0' };
      return {
        product_id: productId,
        event_id: ev.id,
        available_quantity_presale: Number.parseInt(entry.presale || '0', 10),
        available_quantity_inperson: Number.parseInt(entry.inperson || '0', 10),
      };
    });

    const invalid = rows.find(
      (r) =>
        !Number.isInteger(r.available_quantity_presale) ||
        !Number.isInteger(r.available_quantity_inperson) ||
        r.available_quantity_presale < 0 ||
        r.available_quantity_inperson < 0,
    );
    if (invalid) {
      setError('Quantities must be whole numbers of 0 or more.');
      return;
    }

    setSaving(true);
    const { error: upError } = await supabase
      .from('product_event_availability')
      .upsert(rows, { onConflict: 'product_id,event_id' });
    setSaving(false);

    if (upError) {
      setError(upError.message);
      return;
    }
    navigate(`/vendor/products/${productId}/edit`);
  }

  if (loading) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link to={`/vendor/products/${productId}/edit`} className="app-back-link">← Product</Link>
      <h1 className="app-title">Event availability</h1>
      <p className="app-subtitle">
        Set presale (online) vs in-person booth quantities for each event you attend.
      </p>

      {events.length === 0 ? (
        <div className="app-card app-card--honeydew">
          <p className="app-row-meta">Join an event first to set availability.</p>
          <Link to="/vendor/events" className="app-btn app-btn--primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            Browse events
          </Link>
        </div>
      ) : (
        <div className="app-list">
          {events.map((ev) => (
            <div key={ev.id} className="app-card">
              <p className="app-row-title">{ev.name}</p>
              <p className="app-row-meta">{formatEventDate(ev.start_datetime)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div className="app-input-group" style={{ margin: 0 }}>
                  <label>Presale qty</label>
                  <input
                    className="app-input"
                    value={quantities[ev.id]?.presale ?? '0'}
                    onChange={(e) => setQty(ev.id, 'presale', e.target.value)}
                  />
                </div>
                <div className="app-input-group" style={{ margin: 0 }}>
                  <label>In-person qty</label>
                  <input
                    className="app-input"
                    value={quantities[ev.id]?.inperson ?? '0'}
                    onChange={(e) => setQty(ev.id, 'inperson', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="app-error">{error}</p> : null}

      {events.length > 0 ? (
        <button type="button" className="app-btn app-btn--primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save availability'}
        </button>
      ) : null}
    </div>
  );
}
