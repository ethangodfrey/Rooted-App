import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  isPostModerationConfigured,
  MODERATION_RECOMMENDATION_LABEL,
  MODERATION_STATUS_LABEL,
  runPostModerationQueue,
  type AdminModerationPost,
  type PostModerationSuggestion,
} from '@/lib/admin-post-agent';
import { POST_TYPE_LABEL } from '@/lib/post-type';
import type { PostType } from '@/types/database';
import { formatRelativeTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type Filter = 'flagged' | 'unreviewed' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'flagged', label: 'Flagged' },
  { key: 'unreviewed', label: 'Queue' },
  { key: 'all', label: 'All' },
];

const POST_SELECT =
  'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, moderation_status, publish_at, created_at, vendor:vendors(id, business_name)';

export function AdminPostsPage() {
  const [filter, setFilter] = useState<Filter>('flagged');
  const [posts, setPosts] = useState<AdminModerationPost[]>([]);
  const [suggestionsByPost, setSuggestionsByPost] = useState<Record<string, PostModerationSuggestion>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moderating, setModerating] = useState(false);

  const loadSuggestions = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) {
      setSuggestionsByPost({});
      return;
    }
    const { data } = await supabase
      .from('post_moderation_suggestions')
      .select('id, post_id, recommendation, confidence, summary, categories, flags, reasons, agent_version, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: false });

    const map: Record<string, PostModerationSuggestion> = {};
    for (const row of data ?? []) {
      if (map[row.post_id]) continue;
      map[row.post_id] = {
        ...row,
        confidence: Number(row.confidence),
        categories: (row.categories as string[]) ?? [],
        flags: (row.flags as string[]) ?? [],
        reasons: (row.reasons as string[]) ?? [],
      } as PostModerationSuggestion;
    }
    setSuggestionsByPost(map);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .neq('moderation_status', 'removed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'flagged') {
      query = query.eq('moderation_status', 'flagged');
    } else if (filter === 'unreviewed') {
      query = query.eq('moderation_status', 'unreviewed');
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      setPosts([]);
    } else {
      const rows = (data as unknown as AdminModerationPost[]) ?? [];
      setPosts(rows);
      await loadSuggestions(rows.map((p) => p.id));
    }
    setLoading(false);
  }, [filter, loadSuggestions]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function handleRunModeration() {
    if (!isPostModerationConfigured()) return;
    setModerating(true);
    setError(null);
    try {
      await runPostModerationQueue();
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed.');
    } finally {
      setModerating(false);
    }
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Posts</h1>

      {isPostModerationConfigured() ? (
        <button
          type="button"
          className="app-btn app-btn--secondary"
          style={{ marginBottom: '1rem' }}
          disabled={moderating}
          onClick={() => void handleRunModeration()}>
          {moderating ? 'Running moderation…' : 'Run AI moderation queue'}
        </button>
      ) : null}

      <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-chip${filter === item.key ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : posts.length === 0 ? (
        <div className="app-empty">No posts in this filter.</div>
      ) : (
        <div className="app-list">
          {posts.map((post) => {
            const suggestion = suggestionsByPost[post.id];
            return (
              <Link key={post.id} to={`/admin/posts/${post.id}`} className="app-card app-card--pressable">
                <p className="app-row-title">{post.vendor?.business_name ?? 'Vendor'}</p>
                <p className="app-row-meta">
                  {POST_TYPE_LABEL[post.post_type as PostType]} · {MODERATION_STATUS_LABEL[post.moderation_status]}
                </p>
                <p style={{ margin: '0.5rem 0' }}>{post.caption}</p>
                {suggestion ? (
                  <p className="app-row-meta">AI: {MODERATION_RECOMMENDATION_LABEL[suggestion.recommendation]}</p>
                ) : null}
                <p className="app-row-meta">{formatRelativeTime(post.publish_at)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
