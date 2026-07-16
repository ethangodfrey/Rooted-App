import { useCallback, useEffect, useRef, useState } from 'react';

import { ExploreSwipeSlide } from '@/components/explore/ExploreSwipeSlide';
import { useUserCoords } from '@/hooks/use-user-coords';
import {
  EXPLORE_FEED_DEFAULT_RADIUS_MILES,
  EXPLORE_FEED_MAX_RADIUS_MILES,
  EXPLORE_FEED_MIN_RADIUS_MILES,
  fetchExploreHybridFeed,
  type ExploreHybridFeedItem,
} from '@/lib/explore-hybrid-feed';
import '@/components/explore/explore-swipe-feed.css';

const RADIUS_OPTIONS = [15, 25, 35, 50];

/**
 * Premium mobile-native vertical snap discovery feed.
 */
export function ShopperExplorePage() {
  const { coords, source } = useUserCoords();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
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
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [loadPage]);

  // Prefetch next page when the user nears the end of the snap stack.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !nextCursor || loadingMore) return;

    const onScroll = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remaining < root.clientHeight * 1.25) {
        void loadPage(nextCursor, true);
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [nextCursor, loadingMore, loadPage]);

  return (
    <div className="explore-swipe">
      <header className="explore-swipe__header fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0B1228]/60 border-b border-white/5 p-4">
        <div className="explore-swipe__header-inner">
          <p className="explore-swipe__brand">Explore</p>
          <div className="explore-swipe__filters" role="group" aria-label="Search radius">
            {RADIUS_OPTIONS.filter(
              (miles) =>
                miles >= EXPLORE_FEED_MIN_RADIUS_MILES && miles <= EXPLORE_FEED_MAX_RADIUS_MILES,
            ).map((miles) => (
              <button
                key={miles}
                type="button"
                onClick={() => setRadiusMiles(miles)}
                className={`explore-swipe__chip${
                  radiusMiles === miles ? ' explore-swipe__chip--active' : ''
                }`}
                aria-pressed={radiusMiles === miles}
              >
                {miles} mi
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="explore-swipe__scroller h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
      >
        {!coords && !loading ? (
          <div className="explore-swipe__state">
            <h2>Location needed</h2>
            <p>
              Enable location or add your city in profile to unlock the nearby swipe feed
              {source === 'profile' ? ' from your saved area' : ''}.
            </p>
          </div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="explore-swipe__state" aria-busy="true">
            <div className="app-spinner" />
            <p>Curating nearby makers…</p>
          </div>
        ) : null}

        {error ? (
          <div className="explore-swipe__state">
            <h2>Couldn’t load feed</h2>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && items.length === 0 && coords && !error ? (
          <div className="explore-swipe__state">
            <h2>Nothing nearby yet</h2>
            <p>
              No posts within {radiusMiles} miles. Widen the radius filter above or check back after
              vendors publish.
            </p>
          </div>
        ) : null}

        {items.map((item, index) => (
          <ExploreSwipeSlide
            key={`${item.item_type}-${item.item_id}`}
            item={item}
            index={index}
          />
        ))}
      </div>

      {nextCursor && items.length > 0 ? (
        <div className="explore-swipe__load-more">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadPage(nextCursor, true)}
          >
            {loadingMore ? 'Loading…' : 'Swipe for more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
