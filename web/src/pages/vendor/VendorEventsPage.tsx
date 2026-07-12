import { useCallback, useEffect, useMemo, useState } from 'react';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { useNow } from '@/hooks/use-now';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { formatEventDisplayDate, formatEventDisplayTimeRange } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorEventsPage() {
  const { vendor } = useAuth();
  const now = useNow();
  const [events, setEvents] = useState<Event[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    setError(null);

    const [eventsRes, participationRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('visibility_status', 'public')
        .order('start_datetime', { ascending: true }),
      supabase.from('vendor_events').select('event_id').eq('vendor_id', vendor.id),
    ]);

    if (eventsRes.error) {
      setError(eventsRes.error.message);
    } else {
      setEvents(eventsRes.data ?? []);
    }
    if (!participationRes.error && participationRes.data) {
      setJoined(new Set(participationRes.data.map((row) => row.event_id as string)));
    }
  }, [vendor]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function toggle(eventId: string) {
    if (!vendor) return;
    setBusyId(eventId);
    setError(null);

    const isJoined = joined.has(eventId);
    if (isJoined) {
      const { error: delError } = await supabase
        .from('vendor_events')
        .delete()
        .eq('vendor_id', vendor.id)
        .eq('event_id', eventId);
      if (delError) {
        setError(delError.message);
      } else {
        setJoined((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    } else {
      const { error: insError } = await supabase.from('vendor_events').upsert(
        {
          vendor_id: vendor.id,
          event_id: eventId,
          participation_status: 'approved',
        },
        { onConflict: 'vendor_id,event_id' },
      );
      if (insError) {
        setError(insError.message);
      } else {
        setJoined((prev) => new Set(prev).add(eventId));
      }
    }

    setBusyId(null);
  }

  const sortedEvents = useMemo(() => sortEventsByRuntime(events, now), [events, now]);

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Vendor"
        title="My events"
        pill={loading ? undefined : `${joined.size} joined`}
      />

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <VendorEmpty message="No public events available yet." />
      ) : (
        <VendorSection title="Markets">
          <VendorListPanel>
            {sortedEvents.map((event) => {
              const isJoined = joined.has(event.id);
              const phase = eventRuntimePhase(event, now);
              return (
                <div
                  key={event.id}
                  className={`p-3.5${phase === 'closed' ? ' opacity-60' : ''}${phase === 'live' ? ' bg-emerald-50/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <IconBadge name="map-pin" tone="sky" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1">
                        <EventStatusBadge event={event} />
                      </div>
                      <p className="m-0 truncate text-sm font-semibold text-stone-800">{event.name}</p>
                      <p className="m-0 mt-0.5 text-xs text-stone-500">
                        {formatEventDisplayDate(event, now)} · {formatEventDisplayTimeRange(event)}
                      </p>
                      {event.city ? (
                        <p className="m-0 mt-0.5 text-xs text-stone-400">
                          {event.city}, {event.state}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`app-btn app-btn--small mt-3 ${VENDOR_PRESSABLE}${isJoined ? ' app-btn--secondary' : ' app-btn--primary'}`}
                    disabled={busyId === event.id}
                    onClick={() => void toggle(event.id)}
                  >
                    {busyId === event.id ? 'Saving…' : isJoined ? 'Leave event' : 'Join event'}
                  </button>
                </div>
              );
            })}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
