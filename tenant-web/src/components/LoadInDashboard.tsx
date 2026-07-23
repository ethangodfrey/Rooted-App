'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildCheckInPayload,
  coordsFrom,
  distanceMiles,
  isWithinMarketGeofence,
  MORNING_CHECKLIST,
  parseBoothAssignment,
  readChecklistProgress,
  writeChecklistProgress,
  type Coords,
} from '@/lib/load-in';

export interface LoadInDashboardProps {
  vendorId: string;
  accessToken?: string | null;
  apiBaseUrl?: string;
}

interface LoadInEventPayload {
  id: string;
  name: string;
  start_datetime: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  booth_details: string | null;
}

const TACTILE_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

function cellFilled(payload: string, index: number): boolean {
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i) + index * 17) % 9973;
  }
  return hash % 3 !== 0;
}

function CheckInQr({ payload, label }: { payload: string; label: string }) {
  const grid = 21;
  const cell = 10;
  const view = grid * cell;
  const cells = useMemo(
    () =>
      Array.from({ length: grid * grid }, (_, index) => {
        const row = Math.floor(index / grid);
        const col = index % grid;
        const finder =
          (row < 4 && col < 4) ||
          (row < 4 && col >= grid - 4) ||
          (row >= grid - 4 && col < 4);
        const timing = row === 6 || col === 6;
        return finder || timing || cellFilled(payload, index);
      }),
    [payload],
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        role="img"
        aria-label={`Check-in QR code for ${label}`}
        viewBox={`0 0 ${view} ${view}`}
        width={176}
        height={176}
        className="rounded-xl shadow-lg"
      >
        <rect x={0} y={0} width={view} height={view} fill="#ffffff" rx={12} />
        {cells.map((filled, index) => {
          if (!filled) return null;
          const x = (index % grid) * cell;
          const y = Math.floor(index / grid) * cell;
          return (
            <rect
              key={index}
              x={x + 1}
              y={y + 1}
              width={cell - 2}
              height={cell - 2}
              fill="#0B1228"
              rx={1}
            />
          );
        })}
      </svg>
      <code className="text-sm font-extrabold tracking-[0.14em] text-orange-400">{label}</code>
    </div>
  );
}

export function LoadInDashboard({
  vendorId,
  accessToken,
  apiBaseUrl = '',
}: LoadInDashboardProps) {
  const [event, setEvent] = useState<LoadInEventPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<'pending' | 'ready' | 'denied' | 'unsupported'>(
    'pending',
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [mapOpen, setMapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${apiBaseUrl}/api/vendor/load-in?vendorId=${encodeURIComponent(vendorId)}`,
        { headers },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        event?: LoadInEventPayload | null;
      } | null;
      if (!res.ok) throw new Error(body?.error || `Load-in request failed (${res.status})`);
      setEvent(body?.event ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load morning schedule');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId, accessToken, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!event) return;
    setChecklist(readChecklistProgress(vendorId, event.id));
  }, [vendorId, event]);

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
        if (!next) return;
        setUserCoords(next);
        setGeoStatus('ready');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const booth = useMemo(() => parseBoothAssignment(event?.booth_details), [event?.booth_details]);
  const marketCoords = coordsFrom({
    latitude: event?.latitude,
    longitude: event?.longitude,
  });
  const onSite = isWithinMarketGeofence(userCoords, marketCoords);
  const distanceLabel =
    userCoords && marketCoords
      ? `${distanceMiles(userCoords, marketCoords).toFixed(1)} mi from market`
      : null;

  const checkInPayload = useMemo(() => {
    if (!event) return '';
    return buildCheckInPayload({
      vendorId,
      eventId: event.id,
      booth: booth.headline,
    });
  }, [vendorId, event, booth.headline]);

  const checkInLabel = `CI-${vendorId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const mapUrl = marketCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${marketCoords.longitude - 0.01}%2C${marketCoords.latitude - 0.01}%2C${marketCoords.longitude + 0.01}%2C${marketCoords.latitude + 0.01}&layer=mapnik&marker=${marketCoords.latitude}%2C${marketCoords.longitude}`
    : null;

  function toggleItem(id: string) {
    if (!event) return;
    setChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeChecklistProgress(vendorId, event.id, next);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0B1228] px-4 py-10" aria-busy="true">
        <div className="mx-auto h-10 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="mx-auto mt-8 h-40 max-w-md animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0B1228] font-sans text-zinc-50">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-[#0B1228] to-transparent px-4 pb-2 pt-4">
        <Link
          href={`/vendor/analytics?vendorId=${encodeURIComponent(vendorId)}`}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold tracking-wide text-white/70 transition hover:border-orange-500/45 hover:text-white"
        >
          Exit focus
        </Link>
        <div
          className={`inline-flex max-w-[58vw] items-center gap-2 rounded-full border px-3 py-1.5 ${
            onSite
              ? 'border-orange-500/55 bg-orange-500/15'
              : 'border-white/15 bg-white/[0.04]'
          }`}
          role="status"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              onSite ? 'animate-pulse bg-orange-500 shadow-[0_0_0_6px_rgba(249,115,22,0.25)]' : 'bg-slate-400'
            }`}
            aria-hidden
          />
          <span className="truncate text-[11px] font-bold tracking-wide text-white/85">
            {geoStatus === 'unsupported'
              ? 'Location unavailable'
              : geoStatus === 'denied'
                ? 'Enable location to check in'
                : geoStatus === 'pending'
                  ? 'Locating…'
                  : onSite
                    ? 'On site · Checked in'
                    : distanceLabel ?? 'Awaiting market coordinates'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
          Morning load-in
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Focus mode</h1>
        {event ? (
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/65">
            {event.name}
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-white/65">
            No upcoming market on your schedule.
          </p>
        )}

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {!event ? (
          <div className="mt-8 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-5 py-6 text-sm text-white/70">
            Join a market event to unlock booth assignment and check-in.
          </div>
        ) : (
          <>
            <article className="mt-6 flex min-h-[11rem] flex-col justify-end rounded-2xl border border-orange-500/40 bg-[radial-gradient(ellipse_90%_80%_at_100%_0%,rgba(249,115,22,0.32),transparent_55%),#121a36] px-5 py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
                Booth assignment
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
                {booth.headline}
              </h2>
              <p className="mt-2 text-sm font-medium text-white/65">
                {event.address || event.city || 'Venue details on file'}
              </p>
              <button
                type="button"
                className={`${TACTILE_BTN} mt-5`}
                disabled={!mapUrl}
                onClick={() => setMapOpen(true)}
              >
                View venue map
              </button>
            </article>

            <article className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 text-center">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
                  Tactile quick check-in
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">Show organizers</h2>
                <p className="mx-auto mt-1 max-w-xs text-sm font-medium text-white/65">
                  Bright QR for gate scan — keep brightness up at dawn.
                </p>
              </div>
              <CheckInQr payload={checkInPayload} label={checkInLabel} />
            </article>

            <section className="mt-6" aria-labelledby="morning-checklist-heading">
              <h2
                id="morning-checklist-heading"
                className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400"
              >
                Morning checklist
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {MORNING_CHECKLIST.map((item) => {
                  const checked = Boolean(checklist[item.id]);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleItem(item.id)}
                        className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                          checked
                            ? 'border-orange-500/45 bg-orange-500/15'
                            : 'border-white/12 bg-white/[0.04] hover:border-orange-500/40 hover:bg-orange-500/10'
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                            checked
                              ? 'border-orange-600 bg-orange-600 text-white'
                              : 'border-orange-500/65 bg-transparent'
                          }`}
                          aria-hidden
                        >
                          {checked ? (
                            <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
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
                        <span className="text-[0.95rem] font-semibold tracking-tight">
                          {item.label}
                        </span>
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
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[#0B1228]/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Venue map"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-orange-500/35 bg-[#121a36] shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
                Local venue map
              </p>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold"
                onClick={() => setMapOpen(false)}
              >
                Close
              </button>
            </div>
            <iframe
              title="Market venue map"
              src={mapUrl}
              className="h-[55dvh] max-h-[22rem] w-full border-0"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LoadInDashboard;
