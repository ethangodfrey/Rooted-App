import { useEffect, useMemo, useState } from 'react';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorActionGrid,
  VendorActionTile,
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
  VendorStatusPill,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
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
    <VendorScreen>
      <VendorHero eyebrow="Manage" title="Messages" pill={loading ? undefined : `${posts.length} posts`} />

      <VendorActionGrid>
        <VendorActionTile to="/vendor/posts/new" title="New post" icon="message" tone="stone" />
        <VendorActionTile to="/vendor/posts/new-video" title="New video" icon="video" tone="sky" />
      </VendorActionGrid>

      <VendorSection title="Filter">
        <div className="flex gap-2">
          <button
            type="button"
            className={`app-chip ${VENDOR_PRESSABLE}${section === 'posts' ? ' app-chip--selected' : ''}`}
            onClick={() => setSection('posts')}
          >
            Posts
          </button>
          <button
            type="button"
            className={`app-chip ${VENDOR_PRESSABLE}${section === 'videos' ? ' app-chip--selected' : ''}`}
            onClick={() => setSection('videos')}
          >
            Videos
          </button>
        </div>
      </VendorSection>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <VendorEmpty message={section === 'videos' ? 'No videos yet.' : 'No posts yet.'} />
      ) : (
        <VendorSection title="Feed">
          <VendorListPanel>
            {filtered.map((post) => (
              <article key={post.id} className="p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <IconBadge name={post.media_type === 'video' ? 'video' : 'image'} tone="sky" />
                  <VendorStatusPill label={POST_TYPE_LABEL[post.post_type]} />
                </div>
                <p className="m-0 text-sm text-stone-800">{post.caption}</p>
                {post.media_url && post.media_type === 'video' ? (
                  <video
                    src={post.media_url}
                    controls
                    playsInline
                    className="mt-2 max-h-60 w-full rounded-xl"
                  />
                ) : post.media_url ? (
                  <FallbackImage
                    src={post.media_url}
                    variant="banner"
                    alt=""
                    className="mt-2 w-full rounded-xl"
                  />
                ) : null}
                <p className="m-0 mt-2 text-xs text-stone-500">{formatRelativeTime(post.publish_at)}</p>
              </article>
            ))}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
