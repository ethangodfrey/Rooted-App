import { router, useFocusEffect } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { PostModerationCard } from '@/src/components/admin/post-moderation-card';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { PostCard, type FeedPost } from '@/src/components/feed/post-card';
import {
  isPostModerationConfigured,
  MODERATION_RECOMMENDATION_COLOR,
  MODERATION_RECOMMENDATION_LABEL,
  MODERATION_STATUS_LABEL,
  runPostModerationQueue,
  type AdminModerationPost,
  type PostModerationRecommendation,
  type PostModerationStatus,
  type PostModerationSuggestion,
} from '@/src/lib/admin-post-agent';
import { POST_TYPE_LABEL } from '@/src/lib/post-type';
import { supabase } from '@/src/lib/supabase';

type Filter = 'flagged' | 'unreviewed' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'flagged', label: 'Flagged' },
  { key: 'unreviewed', label: 'Queue' },
  { key: 'all', label: 'All' },
];

const POST_SELECT =
  'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, moderation_status, publish_at, created_at, vendor:vendors(id, business_name)';

export default function AdminPostsScreen() {
  const [filter, setFilter] = useState<Filter>('flagged');
  const [posts, setPosts] = useState<AdminModerationPost[]>([]);
  const [suggestionsByPost, setSuggestionsByPost] = useState<
    Record<string, PostModerationSuggestion>
  >({});
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
      .select(
        'id, post_id, recommendation, confidence, summary, categories, flags, reasons, agent_version, created_at',
      )
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

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

  async function handleRunModeration() {
    if (!isPostModerationConfigured()) return;
    setModerating(true);
    setError(null);
    try {
      await runPostModerationQueue();
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation scan failed.');
    } finally {
      setModerating(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-1">
        Post moderation
      </Text>
      <Text variant="subtitle" className="mb-6">
        Review vendor posts and videos flagged by AI for inappropriate content.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      {isPostModerationConfigured() ? (
        <View className="mb-4">
          <Button
            label={moderating ? 'Scanning posts…' : 'Run AI moderation scan'}
            loading={moderating}
            variant="secondary"
            onPress={handleRunModeration}
          />
        </View>
      ) : null}

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
        </Card>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <LoadingIndicator />
        </View>
      ) : posts.length === 0 ? (
        <Card>
          <Text variant="heading" className="mb-1">
            {filter === 'flagged' ? 'No flagged posts' : 'Queue is empty'}
          </Text>
          <Text variant="caption">
            {filter === 'flagged'
              ? 'AI-flagged posts and videos will appear here.'
              : 'New posts enter the queue until AI or an admin approves them.'}
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          {posts.map((post) => {
            const suggestion = suggestionsByPost[post.id];
            const feedPost: FeedPost = {
              ...post,
              vendor: post.vendor,
              product: null,
              event: null,
            };

            return (
              <Card key={post.id}>
                <Pressable onPress={() => router.push(`/(admin)/posts/${post.id}`)}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text variant="caption">
                      {post.vendor?.business_name ?? 'Vendor'} · {POST_TYPE_LABEL[post.post_type]}
                    </Text>
                    <Text variant="caption" className="font-semibold">
                      {MODERATION_STATUS_LABEL[post.moderation_status as PostModerationStatus]}
                    </Text>
                  </View>
                  {suggestion ? (
                    <Text
                      className={`mb-2 text-xs font-semibold ${MODERATION_RECOMMENDATION_COLOR[suggestion.recommendation as PostModerationRecommendation]}`}>
                      AI: {MODERATION_RECOMMENDATION_LABEL[suggestion.recommendation]}
                    </Text>
                  ) : null}
                  <PostCard post={feedPost} showVendor={false} />
                </Pressable>
                <Button
                  label="Review"
                  variant="secondary"
                  onPress={() => router.push(`/(admin)/posts/${post.id}`)}
                />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
