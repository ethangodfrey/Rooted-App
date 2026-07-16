import { useCallback, useEffect, useState } from 'react';

import { ExploreHybridFeedCard } from '@/components/explore/ExploreHybridFeedCard';
import { useUserCoords } from '@/hooks/use-user-coords';
import {
  EXPLORE_FEED_DEFAULT_RADIUS_MILES,
  EXPLORE_FEED_MAX_RADIUS_MILES,
  EXPLORE_FEED_MIN_RADIUS_MILES,
  fetchExploreHybridFeed,
  type ExploreHybridFeedItem,
} from '@/lib/explore-hybrid-feed';
import '@/components/explore/explore-hybrid-feed-card.css';
import '@/components/ui/ui.css';

const RADIUS_OPTIONS = [15, 25, 35, 50];

export function ShopperExplorePage() {
  const { coords, source } = useUserCoords();
  const [radiusMiles, setRadiusMiles] = useState(EXPLORE_FEED_DEFAULT_RADIUS_MILES);
  const [items, setItems] = useState<ExploreHybridFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!coords) {
        setLoading(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const page = await fetchExploreHybridFeed({
          lat: coords.latitude,
          lng: coords.longitude,
          radiusMiles,
          cursor,
        });

        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [coords, radiusMiles],
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void loadPage(null, false);
  }, [loadPage]);

  return (
    <div className="app-screen w-full min-w-0">
      <p className="app-eyebrow">Explore</p>
      <h1 className="app-title">Near you</h1>
      <p className="app-subtitle">
        Local vendor updates and showcase posts ranked by distance and popularity.
        {source === 'gps'
          ? ' Using your location.'
          : source === 'profile'
            ? ' Using your profile area.'
            : ''}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Radius</span>
        {RADIUS_OPTIONS.filter(
          (miles) => miles >= EXPLORE_FEED_MIN_RADIUS_MILES && miles <= EXPLORE_FEED_MAX_RADIUS_MILES,
        ).map((miles) => (
          <button
            key={miles}
            type="button"
            onClick={() => setRadiusMiles(miles)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold tabular-nums transition ${
              radiusMiles === miles
                ? 'border-zinc-900 bg-zinc-900 text-zinc-50'
                : 'border-zinc-200/50 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            {miles} mi
          </button>
        ))}
      </div>

      {!coords && !loading ? (
        <div className="rounded-xl border border-zinc-200/50 bg-white/80 px-4 py-6 text-center backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Location</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">Location needed for nearby feed</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Enable location access or add your city to your profile, then refresh.
          </p>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}

      {!loading && items.length === 0 && coords ? (
        <p className="app-empty">
          No posts within {radiusMiles} miles yet. Try a wider radius or check back after vendors
          publish.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ExploreHybridFeedCard key={`${item.item_type}-${item.item_id}`} item={item} />
        ))}
      </div>

      {nextCursor ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadPage(nextCursor, true)}
            className="rounded-lg border border-zinc-200/50 bg-zinc-950 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
