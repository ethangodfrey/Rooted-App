import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EventForm } from '@/components/admin/EventForm';
import { useNow } from '@/hooks/use-now';
import { formatEventDisplayFullDate, formatEventDisplayTimeRange } from '@/lib/format';
import { marketPath } from '@/lib/market-routes';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

export function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow(60_000);
  const [event, setEvent] = useState<Event | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Event not found.');
      setEvent(null);
    } else {
      setEvent(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!event) return <div className="app-empty">{error ?? 'Not found'}</div>;

  if (editing) {
    return (
      <div className="app-screen app-screen--narrow">
        <button type="button" className="app-back-link" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setEditing(false)}>
          ← Event
        </button>
        <h1 className="app-title">Edit event</h1>
        {error ? <p className="app-error">{error}</p> : null}
        <EventForm
          initial={event}
          submitLabel="Save changes"
          loading={saving}
          onSubmit={async (values) => {
            setSaving(true);
            setError(null);
            const { error: updateError } = await supabase
              .from('events')
              .update({ ...values, updated_at: new Date().toISOString() })
              .eq('id', event.id);
            setSaving(false);
            if (updateError) {
              setError(updateError.message);
              return;
            }
            setEditing(false);
            await load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-screen">
      <Link to="/admin/events" className="app-back-link">← Events</Link>
      <h1 className="app-title">{event.name}</h1>
      <p className="app-subtitle">
        {formatEventDisplayFullDate(event, now)} · {formatEventDisplayTimeRange(event)}
      </p>

      <div className="app-card" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Location</p>
        <p>{event.address ?? '—'}</p>
        <p>{[event.city, event.state].filter(Boolean).join(', ')}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Status</p>
        <p style={{ textTransform: 'capitalize' }}>{event.event_status} · {event.visibility_status}</p>
        {event.description ? <p style={{ marginTop: '0.75rem' }}>{event.description}</p> : null}
      </div>

      <Link to={marketPath(event.id)} className="app-btn app-btn--secondary" style={{ marginRight: '0.5rem' }}>
        View as shopper
      </Link>
      <button type="button" className="app-btn app-btn--primary" onClick={() => setEditing(true)}>
        Edit event
      </button>
    </div>
  );
}
