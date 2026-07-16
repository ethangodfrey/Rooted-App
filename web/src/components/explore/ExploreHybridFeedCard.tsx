import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatExploreDistanceMiles, resolveExploreHybridHref } from '@/lib/explore-hybrid-feed';
import type { ExploreHybridFeedItem } from '@/lib/explore-hybrid-feed';

import './explore-hybrid-feed-card.css';

const CONTENT_KIND_LABEL: Record<string, string> = {
  promotion: 'Promotion',
  launch: 'Launch',
  restock: 'Restock',
  announcement: 'Announcement',
  portfolio: 'Portfolio',
  menu_highlight: 'Menu highlight',
  behind_scenes: 'Behind the scenes',
  recipe: 'Recipe',
};

function resolveMedia(item: ExploreHybridFeedItem): string | null {
  if (item.media_type === 'video' && item.video_thumbnail_url) {
    return item.video_thumbnail_url;
  }
  return item.media_url ?? item.media_urls[0] ?? null;
}

function locationLabel(item: ExploreHybridFeedItem): string | null {
  if (item.sell_city && item.sell_state) return `${item.sell_city}, ${item.sell_state}`;
  if (item.sell_city) return item.sell_city;
  if (item.sell_state) return item.sell_state;
  return null;
}

export interface ExploreHybridFeedCardProps {
  item: ExploreHybridFeedItem;
}

/**
 * Mobile-first hybrid explore card — media posts and storefront details.
 */
export function ExploreHybridFeedCard({ item }: ExploreHybridFeedCardProps) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const href = resolveExploreHybridHref(item);
  const media = resolveMedia(item);
  const distance = formatExploreDistanceMiles(item.distance_miles);
  const kindLabel = CONTENT_KIND_LABEL[item.content_kind] ?? item.content_kind;
  const headline = item.title ?? item.caption?.slice(0, 120) ?? 'Local update';
  const creatorInitial = (item.creator_name ?? '?').charAt(0).toUpperCase();

  const body = (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200/50 bg-white/80 backdrop-blur-md">
      {media && !mediaFailed ? (
        <div className="relative aspect-[4/3] w-full bg-zinc-100 sm:aspect-[16/9]">
          <img
            src={media}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setMediaFailed(true)}
          />
          {item.media_type === 'video' ? (
            <span className="absolute bottom-3 right-3 rounded border border-white/10 bg-zinc-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-50">
              Video
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-zinc-950 sm:aspect-[16/9]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            {item.creator_name ?? 'Local vendor'}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {item.creator_avatar_url && !avatarFailed ? (
            <img
              src={item.creator_avatar_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200/50 object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200/50 bg-zinc-50 text-xs font-bold text-zinc-700">
              {creatorInitial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                {item.creator_name ?? 'Local creator'}
              </p>
              {distance ? (
                <span className="rounded border border-zinc-200/50 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 tabular-nums">
                  {distance}
                </span>
              ) : null}
            </div>
            {locationLabel(item) ? (
              <p className="truncate text-xs font-medium text-zinc-500">{locationLabel(item)}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-zinc-200/50 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {item.item_type === 'vendor_post' ? 'Store update' : 'Showcase'}
          </span>
          <span className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
            {kindLabel}
          </span>
          {item.total_likes > 0 ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 tabular-nums">
              {item.total_likes.toLocaleString()} saves
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-zinc-900">
            {headline}
          </h3>
          {item.title && item.caption ? (
            <p className="mt-1 line-clamp-3 text-xs font-medium leading-relaxed text-zinc-500">
              {item.caption}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!href) return body;

  return (
    <Link to={href} className="block transition-[border-color] duration-150">
      {body}
    </Link>
  );
}
