'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ExploreMenuDrawer } from '@/components/ExploreMenuDrawer';
import { fetchSnapEligibleVendorIds, SNAP_EBT_BADGE_CLASS } from '@/lib/snap-ebt';
import { HOME_KITCHEN_BADGE_CLASS, PRIVATE_CHEF_BADGE_CLASS } from '@/lib/vendor-types';

export interface ExploreSwipeFeedProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialRadiusMiles?: number;
  apiBaseUrl?: string;
  marketplaceUrl?: string | null;
}

interface FeedItem {
  item_type: string;
  item_id: string;
  creator_type: string;
  vendor_id: string | null;
  chef_id: string | null;
  creator_name: string | null;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_urls: string[];
  video_thumbnail_url: string | null;
  media_type: string | null;
  distance_miles: number;
  sell_city: string | null;
  sell_state: string | null;
}

const RADIUS_OPTIONS = [15, 25, 35, 50];

function formatDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0.1) return 'Nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function mediaFor(item: FeedItem): string | null {
  if (item.media_type === 'video' && item.video_thumbnail_url) return item.video_thumbnail_url;
  return item.media_url ?? item.media_urls?.[0] ?? null;
}

function kindLabel(item: FeedItem): string {
  if (item.creator_type === 'chef') return 'LOCAL CHEF';
  if (/farm|produce|grower/i.test(`${item.creator_name ?? ''} ${item.caption ?? ''}`)) {
    return 'LOCAL FARM';
  }
  return 'CURATED VENDOR';
}

export function ExploreSwipeFeed({
  initialLat = null,
  initialLng = null,
  initialRadiusMiles = 25,
  apiBaseUrl = '',
  marketplaceUrl = null,
}: ExploreSwipeFeedProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [radiusMiles, setRadiusMiles] = useState(initialRadiusMiles);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<'pending' | 'ready' | 'denied' | 'provided'>(
    initialLat != null && initialLng != null ? 'provided' : 'pending',
  );
  const [menuVendor, setMenuVendor] = useState<{ id: string; name: string } | null>(null);
  const [snapOnly, setSnapOnly] = useState(false);
  const [snapVendorIds, setSnapVendorIds] = useState<Set<string> | null>(null);
  const [vendorTypes, setVendorTypes] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let active = true;
    void fetchSnapEligibleVendorIds(apiBaseUrl, true)
      .then((ids) => {
        if (active) setSnapVendorIds(ids);
      })
      .catch(() => {
        if (active) setSnapVendorIds(new Set());
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (initialLat != null && initialLng != null) return;
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoStatus('ready');
      },
      () => {
        setGeoStatus('denied');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 },
    );
  }, [initialLat, initialLng]);

  const loadPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (lat == null || lng == null) {
        setLoading(false);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radiusMiles: String(radiusMiles),
          limit: '20',
        });
        if (cursor) params.set('cursor', cursor);
        const res = await fetch(`${apiBaseUrl}/api/explore/feed?${params.toString()}`);
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          items?: FeedItem[];
          nextCursor?: string | null;
        } | null;
        if (!res.ok) throw new Error(body?.error || `Feed failed (${res.status})`);
        const pageItems = Array.isArray(body?.items) ? body.items : [];
        setItems((prev) => (append ? [...prev, ...pageItems] : pageItems));
        setNextCursor(body?.nextCursor ?? null);
        setError(null);

        const vendorIds = pageItems
          .map((item) => item.vendor_id)
          .filter((id): id is string => Boolean(id));
        if (vendorIds.length > 0) {
          const typeRes = await fetch(
            `${apiBaseUrl}/api/explore/vendor-types?ids=${encodeURIComponent(vendorIds.join(','))}`,
          );
          const typeBody = (await typeRes.json().catch(() => null)) as {
            types?: Record<string, string | null>;
          } | null;
          if (typeRes.ok && typeBody?.types) {
            setVendorTypes((prev) => (append ? { ...prev, ...typeBody.types } : { ...typeBody.types }));
          } else if (!append) {
            setVendorTypes({});
          }
        } else if (!append) {
          setVendorTypes({});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load explore feed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiBaseUrl, lat, lng, radiusMiles],
  );

  useEffect(() => {
    if (lat == null || lng == null) return;
    setItems([]);
    setNextCursor(null);
    void loadPage(null, false);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [lat, lng, radiusMiles, loadPage]);

  const marketBase = marketplaceUrl?.replace(/\/$/, '') ?? '';

  const visibleItems = useMemo(() => {
    if (!snapOnly) return items;
    if (!snapVendorIds) return items;
    return items.filter((item) => item.vendor_id && snapVendorIds.has(item.vendor_id));
  }, [items, snapOnly, snapVendorIds]);

  return (
    <div className="relative bg-[#0B1228] text-zinc-50">
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-white/5 bg-[#0B1228]/60 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <p className="m-0 text-[11px] font-extrabold tracking-[0.14em] text-orange-400 uppercase">
            Explore
          </p>
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Discovery filters">
            <button
              type="button"
              onClick={() => setSnapOnly((prev) => !prev)}
              aria-pressed={snapOnly}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold tracking-wide transition ${
                snapOnly
                  ? 'border-emerald-500/70 bg-emerald-950 text-emerald-300'
                  : 'border-emerald-800 bg-emerald-950/50 text-emerald-300/90'
              }`}
            >
              🌾 Accepts SNAP / EBT
            </button>
            {RADIUS_OPTIONS.map((miles) => (
              <button
                key={miles}
                type="button"
                onClick={() => setRadiusMiles(miles)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide transition ${
                  radiusMiles === miles
                    ? 'border-orange-500/55 bg-orange-500/20 text-orange-400'
                    : 'border-white/15 bg-white/[0.04] text-white/70'
                }`}
              >
                {miles} mi
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="no-scrollbar h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
      >
        {geoStatus === 'denied' && lat == null ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 px-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight">Location needed</h2>
            <p className="max-w-sm text-sm text-white/65">
              Allow location or pass <code className="text-orange-400">?lat=&lng=</code> to open the
              swipe feed.
            </p>
          </div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-3" aria-busy>
            <div className="h-8 w-8 animate-pulse rounded-full bg-orange-500/40" />
            <p className="text-sm text-white/65">Curating nearby makers…</p>
          </div>
        ) : null}

        {error ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 px-6 text-center">
            <h2 className="text-2xl font-extrabold">Couldn’t load feed</h2>
            <p className="text-sm text-rose-200">{error}</p>
          </div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 && lat != null ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 px-6 text-center">
            <h2 className="text-2xl font-extrabold">
              {snapOnly ? 'No SNAP / EBT booths nearby' : 'Nothing nearby yet'}
            </h2>
            <p className="max-w-sm text-sm text-white/65">
              {snapOnly
                ? 'Try turning off the SNAP filter or widening the radius.'
                : `No posts within ${radiusMiles} miles. Widen the radius filter above.`}
            </p>
          </div>
        ) : null}

        {visibleItems.map((item, index) => {
          const media = mediaFor(item);
          const name = item.creator_name?.trim() || item.title?.trim() || 'Local maker';
          const desc =
            item.caption?.replace(/\s+/g, ' ').trim().slice(0, 110) ||
            item.title ||
            'Swipe up for the next local maker.';
          const href =
            marketBase && item.vendor_id
              ? `${marketBase}/vendors/${item.vendor_id}`
              : marketBase && item.chef_id
                ? `${marketBase}/shopper/chefs/${item.chef_id}`
                : null;
          const vendorType = item.vendor_id ? vendorTypes[item.vendor_id] ?? null : null;
          const privateChef = vendorType === 'private_chef';
          const typeBadge =
            vendorType === 'private_chef'
              ? { label: 'Private Chef', className: PRIVATE_CHEF_BADGE_CLASS }
              : vendorType === 'home_kitchen'
                ? { label: 'Home Kitchen', className: HOME_KITCHEN_BADGE_CLASS }
                : null;
          const ctaLabel = privateChef
            ? 'Inquire / Book Date'
            : item.creator_type === 'chef'
              ? 'Explore Menu'
              : item.item_type === 'vendor_post'
                ? 'Pre-Order From Booth'
                : 'Explore Menu';
          const opensMenu = Boolean(item.vendor_id) && !privateChef;
          const snapEligible = Boolean(item.vendor_id && snapVendorIds?.has(item.vendor_id));
          const inquireHref =
            privateChef && marketBase && item.vendor_id
              ? `${marketBase}/vendors/${item.vendor_id}?inquire=1`
              : null;

          return (
            <article
              key={`${item.item_type}-${item.item_id}`}
              className="relative flex h-[100dvh] w-full snap-start snap-always flex-col justify-between overflow-hidden p-6 pb-24"
            >
              <div className="absolute inset-0" aria-hidden>
                {media ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media}
                    alt=""
                    className="absolute inset-x-0 top-0 h-[62%] w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-[#1a2448] to-[#0B1228]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0B1228]/20 via-[#0B1228]/70 to-[#0B1228]" />
              </div>

              <header className="relative z-10 pt-16">
                <p className="m-0 text-[11px] font-extrabold tracking-[0.16em] text-white/75 uppercase">
                  {String(index + 1).padStart(2, '0')} / {kindLabel(item)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1.5 text-xs text-orange-400">
                  {formatDistance(item.distance_miles)} away
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {typeBadge ? (
                    <span className={typeBadge.className}>{typeBadge.label}</span>
                  ) : null}
                  {snapEligible ? (
                    <span className={SNAP_EBT_BADGE_CLASS}>SNAP/EBT Eligible</span>
                  ) : null}
                </div>
              </header>

              <div className="relative z-10">
                <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                  {name}
                </h2>
                <p className="mt-3 line-clamp-2 max-w-md text-sm font-medium leading-relaxed text-white/70 md:text-base">
                  {desc}
                </p>
                {inquireHref ? (
                  <a
                    href={inquireHref}
                    className="mt-6 block w-full rounded-xl bg-amber-600 px-6 py-[1.125rem] text-center text-base font-bold tracking-wide text-white shadow-lg transition-all hover:bg-amber-500 active:scale-[0.98]"
                  >
                    {ctaLabel}
                  </a>
                ) : opensMenu ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMenuVendor({
                        id: item.vendor_id as string,
                        name,
                      })
                    }
                    className="mt-6 block w-full rounded-xl bg-orange-600 px-6 py-[1.125rem] text-center text-base font-bold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98]"
                  >
                    {ctaLabel}
                  </button>
                ) : href ? (
                  <a
                    href={href}
                    className="mt-6 block w-full rounded-xl bg-orange-600 px-6 py-[1.125rem] text-center text-base font-bold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98]"
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <span className="mt-6 block w-full rounded-xl bg-orange-600/50 px-6 py-[1.125rem] text-center text-base font-bold tracking-wide text-white opacity-70">
                    {ctaLabel}
                  </span>
                )}
                <div className="mt-3 flex justify-between gap-2">
                  {['Directions', 'Share', 'Favorite'].map((label) => (
                    <span
                      key={label}
                      className="flex min-h-[52px] flex-1 flex-col items-center justify-center text-[10px] font-bold tracking-wide text-white/70 uppercase"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {nextCursor && items.length > 0 ? (
        <div className="pointer-events-none fixed right-0 bottom-20 left-0 z-30 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadPage(nextCursor, true)}
            className="pointer-events-auto rounded-full border border-orange-500/45 bg-[#0B1228]/85 px-5 py-2.5 text-[11px] font-extrabold tracking-widest text-orange-400 uppercase backdrop-blur"
          >
            {loadingMore ? 'Loading…' : 'Swipe for more'}
          </button>
        </div>
      ) : null}

      <ExploreMenuDrawer
        open={menuVendor != null}
        onClose={() => setMenuVendor(null)}
        vendorId={menuVendor?.id ?? null}
        vendorName={menuVendor?.name ?? 'Local maker'}
        apiBaseUrl={apiBaseUrl}
        marketplaceUrl={marketplaceUrl}
      />
    </div>
  );
}

export default ExploreSwipeFeed;
