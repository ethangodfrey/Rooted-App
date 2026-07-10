import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useUserCoords } from '@/hooks/use-user-coords';
import {
  EXPLORE_CONTENT_TYPE_LABEL,
  fetchExploreFeed,
  resolveExploreContentHref,
} from '@/lib/explore-content';
import { formatRelativeTime } from '@/lib/format';
import { fetchRankedVendorFeed, type RankedVendorFeedItem } from '@/lib/ranked-vendor-feed';
import type { ExploreContent } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperExplorePage() {
  const { coords } = useUserCoords();
  const [ranked, setRanked] = useState<RankedVendorFeedItem[]>([]);
  const [items, setItems] = useState<ExploreContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const rankedItems = await fetchRankedVendorFeed(coords, 40);
      if (!active) return;
      setRanked(rankedItems);
      if (rankedItems.length === 0) {
        setItems(await fetchExploreFeed());
      }
      if (active) setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [coords]);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Explore</p>
      <h1 className="app-title">Showcase</h1>
      <p className="app-subtitle">
        Portfolios, recipes, and behind-the-scenes from private chefs, home cooks, and local food businesses.
      </p>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : ranked.length === 0 && items.length === 0 ? (
        <p className="app-empty">
          No showcase posts yet — follow chefs and vendors to see their work here.
        </p>
      ) : ranked.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '1rem',
          }}
        >
          {ranked.map((item, index) => {
            const wide = index % 4 === 3;
            const tilt = index % 6 === 1 ? '-1deg' : index % 6 === 4 ? '1deg' : '0deg';
            const media = item.media_type === 'video'
              ? item.video_thumbnail_url ?? item.media_url
              : item.media_url;
            return (
              <Link
                key={item.id}
                to={`/shopper/vendors/${item.vendor_id}`}
                className="app-card app-card--pressable"
                style={{
                  gridColumn: wide ? 'span 2' : 'span 1',
                  transform: `rotate(${tilt})`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {item.priority_flags.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {item.priority_flags.slice(0, 2).map((flag) => (
                      <span key={flag} className="app-status">
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {media ? (
                  <img
                    src={media}
                    alt=""
                    style={{
                      width: '100%',
                      height: wide ? 260 : 180,
                      borderRadius: '14px',
                      objectFit: 'cover',
                      marginBottom: '0.75rem',
                    }}
                  />
                ) : null}
                <p className="app-row-meta">
                  {item.business_name ?? 'Vendor'} · {formatRelativeTime(item.publish_at)}
                </p>
                <p className="app-row-title" style={{ marginTop: '0.35rem' }}>
                  {item.content ?? item.caption ?? 'Fresh update'}
                </p>
                {item.event_name ? (
                  <p className="app-row-meta" style={{ marginTop: '0.5rem' }}>
                    At {item.event_name}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="app-list">
          {items.map((item) => {
            const href = resolveExploreContentHref(item);
            const cover = item.media_urls?.[0] ?? null;
            const body = (
              <>
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      marginBottom: '0.75rem',
                      maxHeight: '240px',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
                <span className="app-status" style={{ marginBottom: '0.5rem' }}>
                  {EXPLORE_CONTENT_TYPE_LABEL[item.content_type]}
                </span>
                {item.title ? (
                  <p className="app-row-title" style={{ marginTop: '0.5rem' }}>
                    {item.title}
                  </p>
                ) : null}
                {item.caption ? <p className="app-row-meta">{item.caption}</p> : null}
              </>
            );

            return href ? (
              <Link key={item.id} to={href} className="app-card app-card--pressable">
                {body}
              </Link>
            ) : (
              <div key={item.id} className="app-card">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
