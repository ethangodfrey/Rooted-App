import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatRelativeTime } from '@/lib/format';
import { POST_TYPE_LABEL } from '@/lib/post-type';
import { supabase } from '@/lib/supabase';
import type { FeedPost } from '@/types/database';
import '@/components/ui/ui.css';

type PostsSection = 'posts' | 'videos';

export function VendorPostsPage() {
  const { vendor } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [section, setSection] = useState<PostsSection>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!vendor) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('posts')
        .select(
          'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, publish_at, created_at',
        )
        .eq('vendor_id', vendor.id)
        .order('publish_at', { ascending: false });
      setPosts((data as FeedPost[]) ?? []);
      setLoading(false);
    }
    load();
  }, [vendor]);

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        section === 'videos' ? post.media_type === 'video' : post.media_type !== 'video',
      ),
    [posts, section],
  );

  return (
    <div className="app-screen">
      <div className="app-page-header">
        <div>
          <p className="app-eyebrow">Manage</p>
          <h1 className="app-title">Posts</h1>
        </div>
        <div className="app-row" style={{ gap: '0.5rem' }}>
          <Link to="/vendor/posts/new-video" className="app-btn app-btn--secondary app-btn--small">
            + Video
          </Link>
          <Link to="/vendor/posts/new" className="app-btn app-btn--primary app-btn--small">
            + Post
          </Link>
        </div>
      </div>

      <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`app-chip${section === 'posts' ? ' app-chip--selected' : ''}`}
          onClick={() => setSection('posts')}>
          Posts
        </button>
        <button
          type="button"
          className={`app-chip${section === 'videos' ? ' app-chip--selected' : ''}`}
          onClick={() => setSection('videos')}>
          Videos
        </button>
      </div>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="app-empty">
          {section === 'videos' ? 'No videos yet.' : 'No posts yet.'}
        </div>
      ) : (
        <div className="app-list">
          {filtered.map((post) => (
            <article key={post.id} className="app-card">
              <span className="app-status">
                {post.media_type === 'video' ? '🎬 ' : ''}
                {POST_TYPE_LABEL[post.post_type]}
              </span>
              <p style={{ margin: '0.5rem 0' }}>{post.caption}</p>
              {post.media_url && post.media_type === 'video' ? (
                <video
                  src={post.media_url}
                  controls
                  playsInline
                  style={{ width: '100%', borderRadius: '12px', marginBottom: '0.5rem', maxHeight: 240 }}
                />
              ) : post.media_url ? (
                <img
                  src={post.media_url}
                  alt=""
                  style={{ width: '100%', borderRadius: '12px', marginBottom: '0.5rem' }}
                />
              ) : null}
              <p className="app-row-meta">{formatRelativeTime(post.publish_at)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
