import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { EventForm } from '@/components/admin/EventForm';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function AdminEventFormPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/admin/events" className="app-back-link">← Events</Link>
      <h1 className="app-title">New event</h1>
      {error ? <p className="app-error">{error}</p> : null}
      <EventForm
        submitLabel="Create event"
        loading={loading}
        onSubmit={async (values) => {
          setLoading(true);
          setError(null);
          const { data, error: insertError } = await supabase
            .from('events')
            .insert({ ...values, updated_at: new Date().toISOString() })
            .select('id')
            .single();
          setLoading(false);
          if (insertError) {
            setError(insertError.message);
            return;
          }
          navigate(`/admin/events/${data.id}`);
        }}
      />
    </div>
  );
}
