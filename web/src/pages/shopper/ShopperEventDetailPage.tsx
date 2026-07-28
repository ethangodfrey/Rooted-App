import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarketGuideSections } from '@/components/events/MarketGuideSections';
import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { MarketHeroImage } from '@/components/market/MarketHeroImage';
import { MarketDetailSkeleton } from '@/components/market/MarketDetailSkeleton';
import { AttendingVendorGrid } from '@/components/vendor/AttendingVendorGrid';
import { useAuth } from '@/hooks/use-auth';
import { useMarketDetail } from '@/hooks/use-market-detail';
import { useNow } from '@/hooks/use-now';
import { useUserCoords } from '@/hooks/use-user-coords';
import { formatEventDisplayFullDate, formatEventDisplayTimeRange } from '@/lib/format';
import { marketPath } from '@/lib/market-routes';

export function ShopperEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow(60_000);
  const { user } = useAuth();
  const { coords } = useUserCoords();
  const { event, vendors, distanceLabel, loading, error } = useMarketDetail(id);

  const scheduleDateLabel = useMemo(
    () => (event ? formatEventDisplayFullDate(event, now) : null),
    [event, now],
  );

  const scheduleTimeLabel = useMemo(
    () => (event ? formatEventDisplayTimeRange(event) : null),
    [event],
  );

  if (loading) {
    return <MarketDetailSkeleton />;
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? 'Market not found.'}</p>
        <Link to="/explore" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const locationLine = [event.city, event.state].filter(Boolean).join(', ');
  const addressLine = [event.address, event.city, event.state].filter(Boolean).join(', ');

  return (
      <div className="mx-auto min-w-0 max-w-3xl overflow-x-hidden px-4 py-6 sm:px-6">
      <Link
        to="/explore"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Back to map
      </Link>

      <MarketHeroImage event={event} className="mb-5" />

      <div className="mb-3">
        <EventStatusBadge event={event} showHint size="md" />
      </div>

      <header className="mb-6 min-w-0">
        <h1 className="break-words text-xl font-bold tracking-tight text-stone-900 sm:text-2xl md:text-3xl">
          {event.name}
        </h1>
        {locationLine ? (
          <p className="mt-1 text-base text-stone-600">{locationLine}</p>
        ) : null}
        {addressLine ? (
          <p className="mt-2 text-sm text-stone-500">{addressLine}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {scheduleDateLabel ? (
            <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              {scheduleDateLabel}
              {scheduleTimeLabel ? ` · ${scheduleTimeLabel}` : ''}
            </p>
          ) : event.hours_summary ? (
            <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              {event.hours_summary}
            </p>
          ) : null}
          {distanceLabel ? (
            <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {distanceLabel} away
            </p>
          ) : null}
        </div>
        {event.description ? (
          <p className="mt-4 text-sm leading-relaxed text-stone-600">{event.description}</p>
        ) : null}
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Attending vendors</h2>
        <AttendingVendorGrid vendors={vendors} userCoords={coords} marketId={event.id} />
      </section>

      <MarketGuideSections event={event} />

      {user?.role === 'admin' ? (
        <p className="mt-6 text-xs text-stone-400">
          Admin: <Link to={marketPath(event.id)} className="underline">/markets/{event.id}</Link>
        </p>
      ) : null}
    </div>
  );
}
