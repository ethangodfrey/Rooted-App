import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CheckInQr } from '@/components/vendor/check-in-qr';
import { useAuth } from '@/hooks/use-auth';
import { formatEventDisplayDate } from '@/lib/format';
import { coordsFrom, distanceMiles, formatDistance, type Coords } from '@/lib/geo';
import {
  buildCheckInPayload,
  isWithinMarketGeofence,
  MORNING_CHECKLIST,
  parseBoothAssignment,
  readChecklistProgress,
  writeChecklistProgress,
} from '@/lib/load-in';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface LoadInEvent {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown>;
  state?: string | null;
  address?: string | null;
  city?: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface LoadInRow {
  booth_details: string | null;
  event: LoadInEvent;
}

const TACTILE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 no-underline';

function pickTodaysEvent(rows: LoadInRow[], now: Date): LoadInRow | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) =>
    a.event.start_datetime.localeCompare(b.event.start_datetime),
  );
  const today = now.toISOString().slice(0, 10);
  const todayMatch = sorted.find((row) => row.event.start_datetime.slice(0, 10) === today);
  if (todayMatch) return todayMatch;
  const upcoming = sorted.find((row) => new Date(row.event.start_datetime).getTime() >= now.getTime());
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}

export function VendorLoadInPage() {
  const { vendor } = useAuth();
  const [row, setRow] = useState<LoadInRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<'pending' | 'ready' | 'denied' | 'unsupported'>('pending');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [mapOpen, setMapOpen] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setError(null);

    const { data, error: queryError } = await supabase
      .from('vendor_events')
      .select(
        'booth_details, events!inner(id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, state, address, city, latitude, longitude)',
      )
      .eq('vendor_id', vendor.id);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const parsed: LoadInRow[] = (data ?? [])
      .map((entry) => {
        const ev = (entry as { events: LoadInEvent | LoadInEvent[] }).events;
        const event = Array.isArray(ev) ? ev[0] : ev;
        if (!event) return null;
        return {
          booth_details: (entry as { booth_details: string | null }).booth_details,
          event,
        };
      })
      .filter((value): value is LoadInRow => Boolean(value));

    // Prefer booth_label from market registration when booth_details is empty.
    try {
      const { data: regs, error: regError } = await supabase
        .from('vendor_market_registrations')
        .select('booth_label, market:markets(event_id)')
        .eq('vendor_id', vendor.id);

      if (!regError && regs) {
        for (const item of parsed) {
          if (item.booth_details?.trim()) continue;
          const match = regs.find((reg) => {
            const market = (
              reg as { market: { event_id: string | null } | { event_id: string | null }[] | null }
            ).market;
            const m = Array.isArray(market) ? market[0] : market;
            return m?.event_id === item.event.id;
          }) as { booth_label?: string | null } | undefined;
          if (match?.booth_label) {
            item.booth_details = match.booth_label;
          }
        }
      }
    } catch {
      /* optional enrichment — ignore */
    }

    setRow(pickTodaysEvent(parsed, new Date()));
    setLoading(false);
  }, [vendor]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!vendor || !row) return;
    setChecklist(readChecklistProgress(vendor.id, row.event.id));
  }, [vendor, row]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = coordsFrom({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (next) {
          setUserCoords(next);
          setGeoStatus('ready');
        }
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const booth = useMemo(() => parseBoothAssignment(row?.booth_details), [row?.booth_details]);
  const marketCoords = useMemo(
    () => coordsFrom({ latitude: row?.event.latitude, longitude: row?.event.longitude }),
    [row?.event.latitude, row?.event.longitude],
  );
  const onSite = isWithinMarketGeofence(userCoords, marketCoords);
  const distanceLabel =
    userCoords && marketCoords ? formatDistance(distanceMiles(userCoords, marketCoords)) : null;

  const checkInPayload = useMemo(() => {
    if (!vendor || !row) return '';
    return buildCheckInPayload({
      vendorId: vendor.id,
      eventId: row.event.id,
      booth: booth.headline,
    });
  }, [vendor, row, booth.headline]);

  const checkInLabel = useMemo(() => {
    if (!vendor) return 'CHECK-IN';
    const short = vendor.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `CI-${short}`;
  }, [vendor]);

  function toggleItem(id: string) {
    if (!vendor || !row) return;
    setChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeChecklistProgress(vendor.id, row.event.id, next);
      return next;
    });
  }

  const mapUrl = marketCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${marketCoords.longitude - 0.01}%2C${marketCoords.latitude - 0.01}%2C${marketCoords.longitude + 0.01}%2C${marketCoords.latitude + 0.01}&layer=mapnik&marker=${marketCoords.latitude}%2C${marketCoords.longitude}`
    : null;

  if (loading) {
    return (
      <div className="load-in-focus" aria-busy="true">
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="load-in-focus">
      <header className="load-in-focus__top">
        <Link to="/vendor/dashboard" className="load-in-focus__exit">
          Exit focus
        </Link>
        <div
          className={`load-in-geo${onSite ? ' load-in-geo--onsite' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="load-in-geo__pulse" aria-hidden />
          <span className="load-in-geo__label">
            {geoStatus === 'unsupported'
              ? 'Location unavailable'
              : geoStatus === 'denied'
                ? 'Enable location to check in'
                : geoStatus === 'pending'
                  ? 'Locating…'
                  : onSite
                    ? 'On site · Checked in'
                    : distanceLabel
                      ? `${distanceLabel} from market`
                      : 'Awaiting market coordinates'}
          </span>
        </div>
      </header>

      <main className="load-in-focus__main">
        <p className="load-in-kicker">Morning load-in</p>
        <h1 className="load-in-title">Focus mode</h1>
        {row ? (
          <p className="load-in-sub">
            {row.event.name}
            {' · '}
            {formatEventDisplayDate(row.event)}
          </p>
        ) : (
          <p className="load-in-sub">No upcoming market on your schedule.</p>
        )}

        {error ? <p className="app-error mt-3">{error}</p> : null}

        {!row ? (
          <div className="load-in-empty">
            <p>Join a market event to unlock booth assignment and check-in.</p>
            <Link to="/vendor/events" className={`${TACTILE_BTN} mt-4 w-full`}>
              Browse events
            </Link>
          </div>
        ) : (
          <>
            <article className="load-in-booth">
              <p className="load-in-booth__label">Booth assignment</p>
              <h2 className="load-in-booth__headline">{booth.headline}</h2>
              <p className="load-in-booth__meta">
                {row.event.address || row.event.city || 'Venue details on file'}
              </p>
              <button
                type="button"
                className={`${TACTILE_BTN} mt-5 w-full`}
                disabled={!mapUrl}
                onClick={() => setMapOpen(true)}
              >
                View venue map
              </button>
            </article>

            <article className="load-in-checkin">
              <div className="load-in-checkin__copy">
                <p className="load-in-booth__label">Tactile quick check-in</p>
                <h2 className="load-in-checkin__title">Show organizers</h2>
                <p className="load-in-checkin__hint">
                  Bright QR for gate scan — keep brightness up at dawn.
                </p>
              </div>
              <CheckInQr payload={checkInPayload} label={checkInLabel} />
            </article>

            <section className="load-in-checklist" aria-labelledby="morning-checklist-heading">
              <h2 id="morning-checklist-heading" className="load-in-checklist__title">
                Morning checklist
              </h2>
              <ul className="load-in-checklist__list" role="list">
                {MORNING_CHECKLIST.map((item) => {
                  const checked = Boolean(checklist[item.id]);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`load-in-check${checked ? ' load-in-check--done' : ''}`}
                        aria-pressed={checked}
                        onClick={() => toggleItem(item.id)}
                      >
                        <span className="load-in-check__box" aria-hidden>
                          {checked ? (
                            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                              <path
                                d="M4.5 10.5 8 14l7.5-8"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </span>
                        <span className="load-in-check__label">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>

      {mapOpen && mapUrl ? (
        <div className="load-in-map" role="dialog" aria-modal="true" aria-label="Venue map">
          <div className="load-in-map__sheet">
            <div className="load-in-map__bar">
              <p className="load-in-booth__label">Local venue map</p>
              <button type="button" className="load-in-map__close" onClick={() => setMapOpen(false)}>
                Close
              </button>
            </div>
            <iframe title="Market venue map" src={mapUrl} className="load-in-map__frame" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
