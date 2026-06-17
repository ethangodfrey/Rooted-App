import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  isPostModerationConfigured,
  MODERATION_RECOMMENDATION_LABEL,
  MODERATION_STATUS_LABEL,
  moderatePostWithAi,
  recordPostModerationFeedback,
  type AdminModerationPost,
  type PostModerationAdminAction,
  type PostModerationSuggestion,
} from '@/lib/admin-post-agent';
import { POST_TYPE_LABEL } from '@/lib/post-type';
import type { PostType } from '@/types/database';
import { formatRelativeTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const POST_SELECT =
  'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, moderation_status, publish_at, created_at, vendor:vendors(id, business_name)';

export function AdminPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<AdminModerationPost | null>(null);
  const [suggestion, setSuggestion] = useState<PostModerationSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Post not found.');
      setPost(null);
    } else {
      setPost(data as unknown as AdminModerationPost);
    }

    const { data: sug } = await supabase
      .from('post_moderation_suggestions')
      .select('id, post_id, recommendation, confidence, summary, categories, flags, reasons, agent_version, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sug) {
      setSuggestion({
        ...sug,
        confidence: Number(sug.confidence),
        categories: (sug.categories as string[]) ?? [],
        flags: (sug.flags as string[]) ?? [],
        reasons: (sug.reasons as string[]) ?? [],
      } as PostModerationSuggestion);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAiReview() {
    if (!id || !isPostModerationConfigured()) return;
    setReviewing(true);
    setError(null);
    try {
      const result = await moderatePostWithAi(id);
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setReviewing(false);
    }
  }

  async function moderate(action: PostModerationAdminAction, status: 'approved' | 'flagged' | 'removed') {
    if (!post || !user) return;
    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('posts')
      .update({ moderation_status: status })
      .eq('id', post.id);

    if (updateError) {
      setError(updateError.message);
      setActing(false);
      return;
    }

    await recordPostModerationFeedback({
      post,
      adminUserId: user.id,
      adminAction: action,
      suggestion,
    });

    navigate('/admin/posts');
  }

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!post) return <div className="app-empty">{error ?? 'Not found'}</div>;

  return (
    <div className="app-screen">
      <Link to="/admin/posts" className="app-back-link">← Posts</Link>
      <h1 className="app-title">{post.vendor?.business_name ?? 'Post'}</h1>
      <p className="app-subtitle">
        {POST_TYPE_LABEL[post.post_type as PostType]} · {MODERATION_STATUS_LABEL[post.moderation_status]} · {formatRelativeTime(post.publish_at)}
      </p>

      <p style={{ marginBottom: '1rem' }}>{post.caption}</p>

      {post.media_url ? (
        post.media_type === 'video' ? (
          <video src={post.media_url} controls playsInline style={{ width: '100%', borderRadius: 12, marginBottom: '1rem', maxHeight: 360 }} />
        ) : (
          <img src={post.media_url} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: '1rem' }} />
        )
      ) : null}

      {suggestion ? (
        <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
          <p className="app-row-title">AI: {MODERATION_RECOMMENDATION_LABEL[suggestion.recommendation]}</p>
          <p className="app-row-meta">{suggestion.summary}</p>
        </div>
      ) : isPostModerationConfigured() ? (
        <button type="button" className="app-btn app-btn--secondary" style={{ marginBottom: '1rem' }} disabled={reviewing} onClick={() => void handleAiReview()}>
          {reviewing ? 'Reviewing…' : 'Run AI review'}
        </button>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="app-btn app-btn--primary app-btn--small" disabled={acting} onClick={() => void moderate('approved', 'approved')}>Approve</button>
        <button type="button" className="app-btn app-btn--secondary app-btn--small" disabled={acting} onClick={() => void moderate('flagged', 'flagged')}>Flag</button>
        <button type="button" className="app-btn app-btn--secondary app-btn--small" disabled={acting} onClick={() => void moderate('removed', 'removed')}>Remove</button>
      </div>

      {error ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
