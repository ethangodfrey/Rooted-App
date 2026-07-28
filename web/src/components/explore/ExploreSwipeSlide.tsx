import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ExploreMenuDrawer } from '@/components/explore/ExploreMenuDrawer';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import {
  formatExploreDistanceMiles,
  resolveExploreHybridHref,
  type ExploreHybridFeedItem,
} from '@/lib/explore-hybrid-feed';

export interface ExploreSwipeSlideProps {
  item: ExploreHybridFeedItem;
  index: number;
  /** Vendor accepts SNAP/EBT or sells SNAP-eligible SKUs. */
  snapEligible?: boolean;
}

function resolveMedia(item: ExploreHybridFeedItem): string | null {
  if (item.media_type === 'video' && item.video_thumbnail_url) {
    return item.video_thumbnail_url;
  }
  return item.media_url ?? item.media_urls[0] ?? null;
}

function slideKindLabel(item: ExploreHybridFeedItem): string {
  if (item.creator_type === 'chef') return 'LOCAL CHEF';
  if (item.item_type === 'showcase') return 'CURATED VENDOR';
  if (/farm|produce|grower/i.test(`${item.creator_name ?? ''} ${item.caption ?? ''}`)) {
    return 'LOCAL FARM';
  }
  return 'CURATED VENDOR';
}

function oneLineDescription(item: ExploreHybridFeedItem): string {
  const caption = item.caption?.replace(/\s+/g, ' ').trim();
  if (caption) return caption.slice(0, 110);
  if (item.title) return item.title;
  const place = [item.sell_city, item.sell_state].filter(Boolean).join(', ');
  if (place) return `Discover their booth near ${place}.`;
  return 'Swipe up for the next local maker.';
}

function directionsUrl(item: ExploreHybridFeedItem): string | null {
  const q = [item.sell_city, item.sell_state].filter(Boolean).join(', ');
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Full-viewport snap slide for the shopper explore swipe feed.
 */
export function ExploreSwipeSlide({ item, index, snapEligible = false }: ExploreSwipeSlideProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSaved, toggle, pending } = useSavedVendors();
  const href = resolveExploreHybridHref(item);
  const media = resolveMedia(item);
  const distance = formatExploreDistanceMiles(item.distance_miles);
  const label = `${String(index + 1).padStart(2, '0')} / ${slideKindLabel(item)}`;
  const name = item.creator_name?.trim() || item.title?.trim() || 'Local maker';
  const description = oneLineDescription(item);
  const mapsUrl = directionsUrl(item);
  const vendorId = item.vendor_id;
  const saved = vendorId ? isSaved(vendorId) : false;
  const opensMenuDrawer = Boolean(vendorId);
  const ctaLabel =
    item.creator_type === 'chef'
      ? 'Explore Menu'
      : item.item_type === 'vendor_post'
        ? 'Pre-Order From Booth'
        : 'Explore Menu';

  async function handleShare() {
    const shareUrl = href
      ? `${window.location.origin}${href}`
      : window.location.href;
    const shareData = {
      title: name,
      text: description,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* user cancelled or clipboard blocked */
    }
  }

  return (
    <article className="explore-swipe__slide h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col justify-between p-6 pb-24">
      <div className="explore-swipe__media" aria-hidden>
        <FallbackImage
          src={media}
          variant="banner"
          label={name}
          className="explore-swipe__media-img"
        />
        <div className="explore-swipe__media-fade" />
      </div>

      <header className="explore-swipe__top relative z-10 pt-16">
        <p className="explore-swipe__index-label">{label}</p>
        {distance ? (
          <span className="mt-3 bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1">
            <span className="explore-swipe__pulse" aria-hidden />
            {distance} away
          </span>
        ) : (
          <span className="mt-3 bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1">
            <span className="explore-swipe__pulse" aria-hidden />
            Nearby
          </span>
        )}
        {snapEligible ? (
          <span className="mt-2 inline-flex items-center rounded-lg border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300">
            SNAP/EBT Eligible
          </span>
        ) : null}
      </header>

      <div className="explore-swipe__bottom relative z-10">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
          {name}
        </h2>
        <p className="explore-swipe__desc">{description}</p>

        <div className="explore-swipe__actions mt-6">
          {opensMenuDrawer ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="w-full py-[1.125rem] px-6 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white text-base font-bold tracking-wide rounded-xl shadow-lg transition-all text-center"
            >
              {ctaLabel}
            </button>
          ) : href ? (
            <Link
              to={href}
              className="w-full py-[1.125rem] px-6 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white text-base font-bold tracking-wide rounded-xl shadow-lg transition-all text-center no-underline block"
            >
              {ctaLabel}
            </Link>
          ) : (
            <span className="w-full py-[1.125rem] px-6 bg-orange-600/50 text-white text-base font-bold tracking-wide rounded-xl shadow-lg text-center block opacity-70">
              {ctaLabel}
            </span>
          )}

          <div className="explore-swipe__secondary" role="group" aria-label="Quick actions">
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="explore-swipe__icon-btn"
              >
                <DirectionsIcon />
                <span>Directions</span>
              </a>
            ) : (
              <button type="button" className="explore-swipe__icon-btn" disabled>
                <DirectionsIcon />
                <span>Directions</span>
              </button>
            )}
            <button type="button" className="explore-swipe__icon-btn" onClick={() => void handleShare()}>
              <ShareIcon />
              <span>Share</span>
            </button>
            <button
              type="button"
              className={`explore-swipe__icon-btn${saved ? ' explore-swipe__icon-btn--active' : ''}`}
              disabled={!vendorId || pending}
              onClick={() => {
                if (vendorId) void toggle(vendorId);
              }}
            >
              <HeartIcon filled={saved} />
              <span>{saved ? 'Saved' : 'Favorite'}</span>
            </button>
          </div>
        </div>
      </div>

      <ExploreMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        vendorId={vendorId}
        vendorName={name}
      />
    </article>
  );
}

function DirectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M12 3 4 11h5v8h6v-8h5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 11 15.8 6.2M8.2 13l7.6 4.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
