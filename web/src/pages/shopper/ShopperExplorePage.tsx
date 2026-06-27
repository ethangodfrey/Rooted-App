import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  EXPLORE_CONTENT_TYPE_LABEL,
  fetchExploreFeed,
  resolveExploreContentHref,
} from '@/lib/explore-content';
import type { ExploreContent } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperExplorePage() {
  const [items, setItems] = useState<ExploreContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExploreFeed().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

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
      ) : items.length === 0 ? (
        <p className="app-empty">
          No showcase posts yet — follow chefs and vendors to see their work here.
        </p>
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
