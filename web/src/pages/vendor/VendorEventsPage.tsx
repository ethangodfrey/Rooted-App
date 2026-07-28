import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

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
import {
  COMMUNITY_EVENT_TYPES,
  fetchCommunityEventsForCreator,
  publishCommunityEvent,
  type CommunityEvent,
  type CommunityEventType,
} from '@/lib/community-events';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { formatEventDisplayDate, formatEventDisplayTimeRange } from '@/lib/format';
import { coordsFrom } from '@/lib/geo';
import { fetchNearbyMarkets } from '@/lib/national-markets-api';
import { supabase } from '@/lib/supabase';
import type { NearbyNationalMarket } from '@/types/pos-transactions';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function VendorEventsPage() {
  const { user, vendor } = useAuth();
  const profileId = user?.id ?? null;
  const role = user?.role ?? null;
  const canHost = role === 'vendor' || role === 'farmer';
  const now = useNow();

  const [events, setEvents] = useState<Event[]>([]);
  const [hosted, setHosted] = useState<CommunityEvent[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearbyMarkets, setNearbyMarkets] = useState<NearbyNationalMarket[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyReady, setNearbyReady] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<CommunityEventType>('POP_UP');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [startTime, setStartTime] = useState(() => toLocalInputValue(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 4);
    return toLocalInputValue(end);
  });

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);

    const tasks: Promise<void>[] = [];

    tasks.push(
      (async () => {
        const rows = await fetchCommunityEventsForCreator(profileId);
        setHosted(rows);
      })(),
    );

    if (vendor) {
      tasks.push(
        (async () => {
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
        })(),
      );
    } else {
      setEvents([]);
      setJoined(new Set());
    }

    await Promise.all(tasks);
  }, [profileId, vendor]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    async function loadNearby() {
      if (!vendor) {
        setNearbyReady(true);
        return;
      }
      setNearbyLoading(true);

      try {
        const resolveCoords = (): Promise<{ lat: number; lng: number } | null> =>
          new Promise((resolve) => {
            const vendorCoords = coordsFrom({
              latitude: vendor.latitude,
              longitude: vendor.longitude,
            });
            if (vendorCoords) {
              resolve({ lat: vendorCoords.latitude, lng: vendorCoords.longitude });
              return;
            }
            if (!navigator.geolocation) {
              resolve(null);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const gps = coordsFrom({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
                resolve(gps ? { lat: gps.latitude, lng: gps.longitude } : null);
              },
              () => resolve(null),
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
            );
          });

        const coords = await resolveCoords();
        if (cancelled) return;

        if (!coords) {
          setNearbyMarkets([]);
          return;
        }

        const markets = await fetchNearbyMarkets(coords.lat, coords.lng, 50);
        if (!cancelled) setNearbyMarkets(markets);
      } catch {
        if (!cancelled) setNearbyMarkets([]);
      } finally {
        if (!cancelled) {
          setNearbyReady(true);
          setNearbyLoading(false);
        }
      }
    }

    void loadNearby();
    return () => {
      cancelled = true;
    };
  }, [vendor?.id, vendor?.latitude, vendor?.longitude]);

  useEffect(() => {
    if (vendor?.latitude != null && vendor?.longitude != null) {
      setLatitude(String(vendor.latitude));
      setLongitude(String(vendor.longitude));
    }
  }, [vendor?.latitude, vendor?.longitude]);

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

  async function onPublish(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !canHost) return;
    setPublishing(true);
    setFormError(null);
    try {
      await publishCommunityEvent({
        creatorId: profileId,
        title,
        description,
        eventType,
        latitude: Number(latitude),
        longitude: Number(longitude),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setTitle('');
      setDescription('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to publish event');
    } finally {
      setPublishing(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormError('Geolocation is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
      },
      () => setFormError('Unable to read your location.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const sortedEvents = useMemo(() => sortEventsByRuntime(events, now), [events, now]);
  const activeHosted = useMemo(
    () => hosted.filter((row) => new Date(row.end_time).getTime() > now.getTime()),
    [hosted, now],
  );

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Vendor"
        title="Events"
        pill={loading ? undefined : `${activeHosted.length} hosted`}
      />

      {error ? <p className="app-error">{error}</p> : null}

      {canHost ? (
        <VendorSection title="Community events">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`app-btn app-btn--primary app-btn--small ${VENDOR_PRESSABLE}`}
              onClick={() => setFormOpen((open) => !open)}
            >
              {formOpen ? 'CLOSE FORM' : 'CREATE LOCAL EVENT'}
            </button>
          </div>

          {formOpen ? (
            <form
              onSubmit={(e) => void onPublish(e)}
              className="mb-4 space-y-3 rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
                CREATE LOCAL EVENT
              </p>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Title
                </span>
                <input
                  className="app-input w-full"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                  required
                  maxLength={120}
                  placeholder="Saturday pop-up market"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Description
                </span>
                <textarea
                  className="app-input w-full min-h-[88px]"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  maxLength={2000}
                  placeholder="What shoppers should expect"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Type
                </span>
                <select
                  className="app-input w-full"
                  value={eventType}
                  onChange={(ev) => setEventType(ev.target.value as CommunityEventType)}
                >
                  {COMMUNITY_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Latitude
                  </span>
                  <input
                    className="app-input w-full"
                    value={latitude}
                    onChange={(ev) => setLatitude(ev.target.value)}
                    required
                    inputMode="decimal"
                    placeholder="39.7392"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Longitude
                  </span>
                  <input
                    className="app-input w-full"
                    value={longitude}
                    onChange={(ev) => setLongitude(ev.target.value)}
                    required
                    inputMode="decimal"
                    placeholder="-104.9903"
                  />
                </label>
              </div>

              <button
                type="button"
                className={`app-btn app-btn--secondary app-btn--small ${VENDOR_PRESSABLE}`}
                onClick={useMyLocation}
              >
                USE MY LOCATION
              </button>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Start
                  </span>
                  <input
                    type="datetime-local"
                    className="app-input w-full"
                    value={startTime}
                    onChange={(ev) => setStartTime(ev.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    End
                  </span>
                  <input
                    type="datetime-local"
                    className="app-input w-full"
                    value={endTime}
                    onChange={(ev) => setEndTime(ev.target.value)}
                    required
                  />
                </label>
              </div>

              {formError ? <p className="app-error m-0">{formError}</p> : null}

              <p className="m-0 text-xs text-stone-500">
                Submissions stay PENDING until an admin verifies them. Approved events appear as
                orange pins on the shopper map.
              </p>

              <button
                type="submit"
                className={`app-btn app-btn--primary ${VENDOR_PRESSABLE}`}
                disabled={publishing}
              >
                {publishing ? 'SUBMITTING…' : '[ SUBMIT FOR REVIEW ]'}
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="app-loading">
              <div className="app-spinner" />
            </div>
          ) : hosted.length === 0 ? (
            <VendorEmpty message="No hosted community events yet. Publish a local festival, pop-up, or city market." />
          ) : (
            <VendorListPanel>
              {hosted.map((event) => {
                const active = new Date(event.end_time).getTime() > now.getTime();
                return (
                  <div
                    key={event.id}
                    className={`p-3.5${active ? '' : ' opacity-60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <IconBadge name="map-pin" tone="amber" />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">
                          {event.event_type.replace(/_/g, ' ')} ·{' '}
                          {event.verification_status.toUpperCase()}
                        </p>
                        <p className="m-0 mt-1 truncate text-sm font-semibold text-stone-800">
                          {event.title}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-stone-500">
                          {new Date(event.start_time).toLocaleString()} —{' '}
                          {new Date(event.end_time).toLocaleString()}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-stone-400">
                          {(() => {
                            const coords = coordsFrom({
                              latitude: event.latitude,
                              longitude: event.longitude,
                            });
                            return coords
                              ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                              : '—';
                          })()}
                          {active ? ' · SCHEDULED' : ' · ENDED'}
                          {event.verification_status === 'pending'
                            ? ' · AWAITING ADMIN'
                            : ''}
                          {event.rejection_reason
                            ? ` · ${event.rejection_reason}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </VendorListPanel>
          )}
        </VendorSection>
      ) : null}

      <VendorSection title="National markets nearby">
        {nearbyLoading ? (
          <div className="app-loading">
            <div className="app-spinner" />
          </div>
        ) : nearbyReady && nearbyMarkets.length === 0 ? (
          <VendorEmpty message="No national farmers markets found nearby. Update your vendor address or try again later." />
        ) : nearbyMarkets.length > 0 ? (
          <VendorListPanel>
            {nearbyMarkets.slice(0, 12).map((market) => (
              <div key={market.id} className="flex items-start gap-3 p-3.5">
                <IconBadge name="map-pin" tone="emerald" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-stone-800">{market.marketName}</p>
                  <p className="m-0 mt-0.5 text-xs text-stone-500">
                    {market.city}, {market.state}
                    {market.distanceMiles > 0
                      ? ` · ${market.distanceMiles.toFixed(1)} mi`
                      : ''}
                  </p>
                  {market.streetAddress ? (
                    <p className="m-0 mt-0.5 text-xs text-stone-400">{market.streetAddress}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </VendorListPanel>
        ) : null}
      </VendorSection>

      {vendor ? (
        loading ? (
          <div className="app-loading">
            <div className="app-spinner" />
          </div>
        ) : sortedEvents.length === 0 ? (
          <VendorEmpty message="No public USDA markets available yet." />
        ) : (
          <VendorSection title="USDA markets — join">
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
        )
      ) : null}
    </VendorScreen>
  );
}
