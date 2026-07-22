import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Store } from 'lucide-react';

import { api, isApiConfigured } from '@/lib/api';
import {
  isStreamableFeedUrl,
  resolveCreatorStreamUrl,
} from '@/lib/media-streaming';
import { supabase } from '@/lib/supabase';
import './vertical-video-feed.css';

export interface VerticalFeedItem {
  id: string;
  vendorId: string;
  vendorName: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  mediaType: 'image' | 'video';
  likes: number;
}

type VerticalVideoFeedProps = {
  /** Limit posts fetched for the feed shell. */
  limit?: number;
};

type CreatorFeedApiRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  caption: string;
  mediaUrl: string;
  streamUrl?: string;
  thumbnailUrl: string | null;
  mediaType: 'image' | 'video';
};

function shareUrl(item: VerticalFeedItem): string {
  if (typeof window === 'undefined') return `/vendors/${item.vendorId}`;
  return `${window.location.origin}/vendors/${item.vendorId}`;
}

async function loadFromCreatorApi(limit: number): Promise<VerticalFeedItem[]> {
  const rows = await api.get<CreatorFeedApiRow[]>(`/api/creator/feed?limit=${limit}`);
  return rows
    .map((row) => {
      const mediaUrl = resolveCreatorStreamUrl({
        streamUrl: row.streamUrl,
        mediaUrl: row.mediaUrl,
      });
      if (!isStreamableFeedUrl(mediaUrl)) return null;
      return {
        id: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendorName || 'Vendor',
        caption: row.caption || 'Creator post',
        mediaUrl,
        thumbnailUrl: row.thumbnailUrl,
        mediaType: row.mediaType === 'video' ? 'video' : 'image',
        likes: 0,
      } satisfies VerticalFeedItem;
    })
    .filter((row): row is VerticalFeedItem => row != null);
}

async function loadFromSupabase(limit: number): Promise<VerticalFeedItem[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      'id, vendor_id, caption, content, media_url, media_type, video_thumbnail_url, cdn_media_url, contribution_metadata, vendors(business_name)',
    )
    .not('media_url', 'is', null)
    .order('publish_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const meta =
        row.contribution_metadata && typeof row.contribution_metadata === 'object'
          ? (row.contribution_metadata as Record<string, unknown>)
          : null;
      const mediaUrl = resolveCreatorStreamUrl({
        cdnMediaUrl: row.cdn_media_url as string | null,
        mediaUrl: row.media_url as string | null,
        contributionMetadata: meta,
      });
      if (!isStreamableFeedUrl(mediaUrl)) return null;
      const vendors = row.vendors as
        | { business_name: string | null }
        | { business_name: string | null }[]
        | null;
      const vendorName = Array.isArray(vendors)
        ? vendors[0]?.business_name
        : vendors?.business_name;
      const mediaType = row.media_type === 'video' ? 'video' : 'image';
      return {
        id: row.id as string,
        vendorId: row.vendor_id as string,
        vendorName: vendorName?.trim() || 'Vendor',
        caption: String(row.caption || row.content || '').trim() || 'Creator post',
        mediaUrl,
        thumbnailUrl: (row.video_thumbnail_url as string | null) ?? null,
        mediaType,
        likes: 0,
      } satisfies VerticalFeedItem;
    })
    .filter((row): row is VerticalFeedItem => row != null);
}

/**
 * Phase 83g — mobile-first full-screen vertical feed for creator multimedia.
 * Prefers streaming URLs from POST /api/creator/upload → GET /api/creator/feed.
 */
export function VerticalVideoFeed({ limit = 24 }: VerticalVideoFeedProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<VerticalFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        let mapped: VerticalFeedItem[] = [];
        if (isApiConfigured) {
          try {
            mapped = await loadFromCreatorApi(limit);
          } catch {
            mapped = await loadFromSupabase(limit);
          }
        } else {
          mapped = await loadFromSupabase(limit);
        }
        if (!active) return;
        setItems(mapped);
        setActiveId(mapped[0]?.id ?? null);
        setError(null);
        setLoading(false);
        console.log(`CREATOR_FEED_ACTIVE COUNT=${mapped.length}`);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'FEED_LOAD_FAILED');
        setItems([]);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [limit]);

  const onScroll = useCallback(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const mid = root.scrollTop + root.clientHeight / 2;
    let closest: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const child of Array.from(root.children)) {
      const el = child as HTMLElement;
      const id = el.dataset.feedId;
      if (!id) continue;
      const center = el.offsetTop + el.offsetHeight / 2;
      const dist = Math.abs(center - mid);
      if (dist < best) {
        best = dist;
        closest = id;
      }
    }
    if (closest) setActiveId(closest);
  }, []);

  async function onShare(item: VerticalFeedItem) {
    const url = shareUrl(item);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.vendorName, text: item.caption, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      console.log(`CREATOR_FEED_SHARE POST=${item.id}`);
    } catch {
      // user cancelled share sheet
    }
  }

  if (loading) {
    return (
      <div className="vvf-shell vvf-shell--empty">
        <div className="app-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="vvf-shell vvf-shell--empty">
        <p className="app-error">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="vvf-shell vvf-shell--empty">
        <p className="ft-subhead">No multimedia posts yet. Publish a photo or video from Listings.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="vvf-shell"
      onScroll={onScroll}
      role="feed"
      aria-label="Creator vertical video feed"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const isLiked = Boolean(liked[item.id]);
        return (
          <article
            key={item.id}
            className="vvf-slide"
            data-feed-id={item.id}
            aria-label={item.caption}
          >
            {item.mediaType === 'video' ? (
              <video
                className="vvf-media"
                src={item.mediaUrl}
                poster={item.thumbnailUrl ?? undefined}
                playsInline
                muted
                loop
                autoPlay={isActive}
                controls={false}
              />
            ) : (
              <img className="vvf-media" src={item.mediaUrl} alt="" />
            )}

            <div className="vvf-gradient" aria-hidden />

            <div className="vvf-meta">
              <p className="vvf-vendor">{item.vendorName}</p>
              <p className="vvf-caption">{item.caption}</p>
            </div>

            <div className="vvf-actions" aria-label="Feed actions">
              <button
                type="button"
                className={`vvf-action ${isLiked ? 'vvf-action--active' : ''}`}
                aria-pressed={isLiked}
                aria-label={isLiked ? 'Unlike' : 'Like'}
                onClick={() =>
                  setLiked((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }))
                }
              >
                <Heart className="vvf-action__icon" aria-hidden />
                <span>{isLiked ? 'Liked' : 'Like'}</span>
              </button>
              <button
                type="button"
                className="vvf-action"
                aria-label="Share"
                onClick={() => void onShare(item)}
              >
                <Share2 className="vvf-action__icon" aria-hidden />
                <span>Share</span>
              </button>
              <Link
                to={`/vendors/${item.vendorId}`}
                className="vvf-action"
                aria-label={`View ${item.vendorName}`}
              >
                <Store className="vvf-action__icon" aria-hidden />
                <span>Vendor</span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
