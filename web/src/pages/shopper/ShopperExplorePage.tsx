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
    <div className="app-screen">
      <p className="app-eyebrow">Explore</p>
      <h1 className="app-title">Near you</h1>
      <p className="app-subtitle">
        Local vendor updates and showcase posts ranked by distance and popularity.
        {source === 'gps' ? ' Using your location.' : source === 'profile' ? ' Using your profile area.' : ''}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Radius</span>
        {RADIUS_OPTIONS.filter(
          (miles) => miles >= EXPLORE_FEED_MIN_RADIUS_MILES && miles <= EXPLORE_FEED_MAX_RADIUS_MILES,
        ).map((miles) => (
          <button
            key={miles}
            type="button"
            onClick={() => setRadiusMiles(miles)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              radiusMiles === miles
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {miles} mi
          </button>
        ))}
      </div>

      {!coords && !loading ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-6 text-center ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">Location needed for nearby feed</p>
          <p className="mt-1 text-sm text-amber-800">
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
          No posts within {radiusMiles} miles yet. Try a wider radius or check back after vendors publish.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
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
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
