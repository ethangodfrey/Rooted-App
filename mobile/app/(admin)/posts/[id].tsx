import { router, useLocalSearchParams } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { PostModerationCard } from '@/src/components/admin/post-moderation-card';
import { PostCard, type FeedPost } from '@/src/components/feed/post-card';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  isPostModerationConfigured,
  moderatePostWithAi,
  MODERATION_STATUS_LABEL,
  recordPostModerationFeedback,
  type AdminModerationPost,
  type PostModerationAdminAction,
  type PostModerationSuggestion,
} from '@/src/lib/admin-post-agent';
import { POST_TYPE_LABEL } from '@/src/lib/post-type';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

export default function AdminPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<AdminModerationPost | null>(null);
  const [suggestion, setSuggestion] = useState<PostModerationSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestion = useCallback(async () => {
    if (!id) return;
    setSuggestionLoading(true);
    const { data } = await supabase
      .from('post_moderation_suggestions')
      .select(
        'id, post_id, recommendation, confidence, summary, categories, flags, reasons, agent_version, created_at',
      )
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSuggestion({
        ...data,
        confidence: Number(data.confidence),
        categories: (data.categories as string[]) ?? [],
        flags: (data.flags as string[]) ?? [],
        reasons: (data.reasons as string[]) ?? [],
      } as PostModerationSuggestion);
    } else {
      setSuggestion(null);
    }
    setSuggestionLoading(false);
  }, [id]);

  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('posts')
      .select(
        'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, moderation_status, publish_at, created_at, vendor:vendors(id, business_name)',
      )
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setPost(null);
    } else if (!data) {
      setError('Post not found.');
      setPost(null);
    } else {
      setPost(data as unknown as AdminModerationPost);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPost();
    loadSuggestion();
  }, [loadPost, loadSuggestion]);

  async function handleScan() {
    if (!id || !isPostModerationConfigured()) return;
    setReviewing(true);
    setError(null);
    try {
      const result = await moderatePostWithAi(id);
      setSuggestion(result);
      await loadPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setReviewing(false);
    }
  }

  async function applyModeration(action: PostModerationAdminAction) {
    if (!post || !user) return;

    const statusMap = {
      approved: 'approved',
      flagged: 'flagged',
      removed: 'removed',
    } as const;

    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('posts')
      .update({ moderation_status: statusMap[action] })
      .eq('id', post.id);

    if (updateError) {
      setActing(false);
      setError(updateError.message);
      return;
    }

    await recordPostModerationFeedback({
      post,
      adminUserId: user.id,
      adminAction: action,
      suggestion,
    });

    setActing(false);

    if (action === 'removed') {
      router.back();
      return;
    }

    await loadPost();
  }

  if (loading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen scroll>
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error ?? 'Post not found.'}
          </Text>
        </Card>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const feedPost: FeedPost = {
    ...post,
    vendor: post.vendor,
    product: null,
    event: null,
  };

  return (
    <Screen scroll>
      <Text variant="title" className="mb-1">
        Review post
      </Text>
      <Text variant="caption" className="mb-4">
        {post.vendor?.business_name ?? 'Vendor'} · {POST_TYPE_LABEL[post.post_type]} ·{' '}
        {MODERATION_STATUS_LABEL[post.moderation_status]}
      </Text>

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
        </Card>
      ) : null}

      <PostCard post={feedPost} showVendor={false} />

      {isPostModerationConfigured() ? (
        <View className="mt-4">
          <PostModerationCard
            suggestion={suggestion}
            loading={suggestionLoading}
            reviewing={reviewing}
            showRefresh
            onRefresh={handleScan}
          />
        </View>
      ) : null}

      {post.moderation_status !== 'removed' ? (
        <View className="mt-2 gap-3">
          <Button
            label="Approve for feed"
            loading={acting}
            onPress={() => applyModeration('approved')}
          />
          <Button
            label="Keep flagged"
            variant="secondary"
            loading={acting}
            onPress={() => applyModeration('flagged')}
          />
          <Button
            label="Remove from feed"
            variant="ghost"
            loading={acting}
            onPress={() => applyModeration('removed')}
          />
        </View>
      ) : null}
    </Screen>
  );
}
