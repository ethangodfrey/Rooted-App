import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ExploreSwipeSlide } from '@/components/explore/ExploreSwipeSlide';
import { useUserCoords } from '@/hooks/use-user-coords';
import {
  EXPLORE_FEED_DEFAULT_RADIUS_MILES,
  EXPLORE_FEED_MAX_RADIUS_MILES,
  EXPLORE_FEED_MIN_RADIUS_MILES,
  fetchExploreHybridFeed,
  type ExploreHybridFeedItem,
} from '@/lib/explore-hybrid-feed';
import { fetchSnapEligibleVendorIds } from '@/lib/snap-ebt';
import { fetchVendorTypesByIds } from '@/lib/vendor-type-lookup';
import type { VendorType } from '@/types/database';
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
  const [snapOnly, setSnapOnly] = useState(false);
  const [snapVendorIds, setSnapVendorIds] = useState<Set<string> | null>(null);
  const [vendorTypes, setVendorTypes] = useState<Map<string, VendorType | null>>(new Map());

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

        const vendorIds = page.items
          .map((item) => item.vendor_id)
          .filter((id): id is string => Boolean(id));
        if (vendorIds.length > 0) {
          const types = await fetchVendorTypesByIds(vendorIds);
          setVendorTypes((prev) => {
            const next = append ? new Map(prev) : new Map<string, VendorType | null>();
            for (const [id, type] of types) next.set(id, type);
            return next;
          });
        } else if (!append) {
          setVendorTypes(new Map());
        }
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

  useEffect(() => {
    let active = true;
    void fetchSnapEligibleVendorIds()
      .then((ids) => {
        if (active) setSnapVendorIds(ids);
      })
      .catch(() => {
        if (active) setSnapVendorIds(new Set());
      });
    return () => {
      active = false;
    };
  }, []);

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

  const visibleItems = useMemo(() => {
    if (!snapOnly) return items;
    if (!snapVendorIds) return items;
    return items.filter((item) => item.vendor_id && snapVendorIds.has(item.vendor_id));
  }, [items, snapOnly, snapVendorIds]);

  return (
    <div className="explore-swipe">
      <header className="explore-swipe__header fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0B1228]/60 border-b border-white/5 p-4">
        <div className="explore-swipe__header-inner">
          <p className="explore-swipe__brand">Explore</p>
          <div className="explore-swipe__filters" role="group" aria-label="Discovery filters">
            <button
              type="button"
              onClick={() => setSnapOnly((prev) => !prev)}
              className={`explore-swipe__chip explore-swipe__chip--snap${
                snapOnly ? ' explore-swipe__chip--snap-active' : ''
              }`}
              aria-pressed={snapOnly}
            >
              🌾 Accepts SNAP / EBT
            </button>
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

        {!loading && visibleItems.length === 0 && coords && !error ? (
          <div className="explore-swipe__state">
            <h2>{snapOnly ? 'No SNAP / EBT booths nearby' : 'Nothing nearby yet'}</h2>
            <p>
              {snapOnly
                ? 'Try turning off the SNAP filter or widening the radius — more vendors may accept EBT at the booth.'
                : `No posts within ${radiusMiles} miles. Widen the radius filter above or check back after vendors publish.`}
            </p>
          </div>
        ) : null}

        {visibleItems.map((item, index) => (
          <ExploreSwipeSlide
            key={`${item.item_type}-${item.item_id}`}
            item={item}
            index={index}
            snapEligible={Boolean(item.vendor_id && snapVendorIds?.has(item.vendor_id))}
            vendorType={item.vendor_id ? vendorTypes.get(item.vendor_id) ?? null : null}
          />
        ))}
      </div>

      {nextCursor && visibleItems.length > 0 ? (
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
