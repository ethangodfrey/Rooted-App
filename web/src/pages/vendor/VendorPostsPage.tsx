import { useEffect, useMemo, useState } from 'react';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorActionGrid,
  VendorActionTile,
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
  VendorStatusPill,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { submitPartnerContributionAction } from '@/lib/content-contributions';
import { formatRelativeTime } from '@/lib/format';
import { POST_TYPE_LABEL } from '@/lib/post-type';
import { supabase } from '@/lib/supabase';
import type { FeedPost, Post } from '@/types/database';
import '@/components/ui/ui.css';

type PostsSection = 'posts' | 'videos';

type PendingPartnershipPost = Pick<
  Post,
  'id' | 'caption' | 'co_approval_status' | 'partner_contributor_id' | 'contributor_type'
>;

export function VendorPostsPage() {
  const { vendor, user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [pending, setPending] = useState<PendingPartnershipPost[]>([]);
  const [section, setSection] = useState<PostsSection>('posts');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

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

      if (user?.id) {
        const { data: pendingRows } = await supabase
          .from('posts')
          .select(
            'id, caption, co_approval_status, partner_contributor_id, contributor_type',
          )
          .eq('partner_contributor_id', user.id)
          .eq('posting_mode', 'PARTNERSHIP')
          .eq('co_approval_status', 'PENDING')
          .order('created_at', { ascending: false });
        setPending((pendingRows as PendingPartnershipPost[]) ?? []);
      }

      setLoading(false);
    }
    load();
  }, [vendor, user?.id]);

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        section === 'videos' ? post.media_type === 'video' : post.media_type !== 'video',
      ),
    [posts, section],
  );

  async function handlePartnerAction(
    postId: string,
    action: 'CO_APPROVE' | 'APPEND' | 'REJECT',
  ) {
    if (!user) return;
    setActingId(postId);
    setActionError(null);
    try {
      if (isApiConfigured) {
        await submitPartnerContributionAction({
          postId,
          action,
          body: action === 'APPEND' ? 'PARTNER APPEND' : null,
          partnerType: 'VENDOR',
        });
      } else {
        const status =
          action === 'CO_APPROVE'
            ? 'APPROVED'
            : action === 'APPEND'
              ? 'APPENDED'
              : 'REJECTED';
        const { error } = await supabase
          .from('posts')
          .update({ co_approval_status: status })
          .eq('id', postId);
        if (error) throw new Error(error.message);
      }
      setPending((rows) => rows.filter((r) => r.id !== postId));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Partner action failed.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <VendorScreen>
      <VendorHero eyebrow="Manage" title="Messages" pill={loading ? undefined : `${posts.length} posts`} />

      <VendorActionGrid>
        <VendorActionTile to="/vendor/posts/new" title="New post" icon="message" tone="stone" />
        <VendorActionTile to="/vendor/posts/new-video" title="New video" icon="video" tone="sky" />
      </VendorActionGrid>

      {pending.length > 0 ? (
        <VendorSection title="Partnership co-approval">
          {actionError ? <p className="app-error">{actionError}</p> : null}
          <VendorListPanel>
            {pending.map((row) => (
              <article key={row.id} className="p-3.5">
                <p className="m-0 text-sm text-stone-800">{row.caption}</p>
                <p className="m-0 mt-1 text-xs text-stone-500">
                  PENDING from {row.contributor_type ?? 'PARTNER'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <VendorPrimaryButton
                    disabled={actingId === row.id}
                    onClick={() => void handlePartnerAction(row.id, 'CO_APPROVE')}
                  >
                    Co-approve
                  </VendorPrimaryButton>
                  <button
                    type="button"
                    className={`app-chip ${VENDOR_PRESSABLE}`}
                    disabled={actingId === row.id}
                    onClick={() => void handlePartnerAction(row.id, 'APPEND')}
                  >
                    Append
                  </button>
                  <button
                    type="button"
                    className={`app-chip ${VENDOR_PRESSABLE}`}
                    disabled={actingId === row.id}
                    onClick={() => void handlePartnerAction(row.id, 'REJECT')}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </VendorListPanel>
        </VendorSection>
      ) : null}

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
