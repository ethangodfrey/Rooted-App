import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { formatRelativeTime } from '@/lib/format';
import { POST_TYPE_ICON, POST_TYPE_LABEL } from '@/lib/post-type';
import {
  fetchShopperFeedPosts,
  resolveFeedPosts,
  resolveShopperLocation,
  type ExploreScope,
  type FeedMode,
} from '@/lib/shopper-feed';
import type { FeedPost } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperFeedPage() {
  const { user, shopper } = useAuth();
  const { saved } = useSavedVendors();
  const [mode, setMode] = useState<FeedMode>('saved');
  const [exploreScope, setExploreScope] = useState<ExploreScope>('local');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { posts: fetched, error: fetchError } = await fetchShopperFeedPosts();
    setPosts(fetched);
    setError(fetchError);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const location = resolveShopperLocation(user?.city, user?.state, shopper?.default_location);

  const displayed = useMemo(
    () => resolveFeedPosts(posts, mode, exploreScope, saved, location),
    [posts, mode, exploreScope, saved, location],
  );

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Updates</p>
      <h1 className="app-title">Feed</h1>

      <div className="app-feed-mode">
        <button type="button" className={`app-chip${mode === 'saved' ? ' app-chip--selected' : ''}`} onClick={() => setMode('saved')}>
          Saved vendors
        </button>
        <button type="button" className={`app-chip${mode === 'explore' ? ' app-chip--selected' : ''}`} onClick={() => setMode('explore')}>
          Explore
        </button>
      </div>

      {mode === 'explore' ? (
        <div className="app-scope-toggle" style={{ marginBottom: '1rem' }}>
          <button type="button" className={exploreScope === 'local' ? 'active' : ''} onClick={() => setExploreScope('local')}>
            Near you
          </button>
          <button type="button" className={exploreScope === 'popular' ? 'active' : ''} onClick={() => setExploreScope('popular')}>
            Popular nationwide
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : displayed.length === 0 ? (
        <div className="app-empty">
          {mode === 'saved'
            ? 'Save vendors to see their posts here, or switch to Explore.'
            : 'No posts in this area yet.'}
        </div>
      ) : (
        <div className="app-list">
          {displayed.map((post) => (
            <article key={post.id} className="app-card">
              <div className="app-row" style={{ marginBottom: '0.5rem' }}>
                <span>{POST_TYPE_ICON[post.post_type]}</span>
                <span className="app-status">{POST_TYPE_LABEL[post.post_type]}</span>
                <span className="app-row-meta">{formatRelativeTime(post.publish_at)}</span>
              </div>
              {post.vendor ? (
                <Link to={`/shopper/vendors/${post.vendor_id}`} style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {post.vendor.business_name ?? 'Vendor'}
                </Link>
              ) : null}
              <p style={{ margin: '0.5rem 0' }}>{post.caption}</p>
              {post.product ? (
                <Link to={`/shopper/products/${post.product.id}`} className="app-row-meta">
                  → {post.product.name}
                </Link>
              ) : null}
              {post.event ? (
                <Link to={`/shopper/events/${post.event.id}`} className="app-row-meta">
                  → {post.event.name}
                </Link>
              ) : null}
              {post.media_url ? (
                post.media_type === 'video' ? (
                  <video
                    src={post.media_url}
                    controls
                    playsInline
                    style={{ width: '100%', borderRadius: '12px', marginTop: '0.75rem', maxHeight: 320 }}
                  />
                ) : (
                  <img src={post.media_url} alt="" style={{ width: '100%', borderRadius: '12px', marginTop: '0.75rem' }} />
                )
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
