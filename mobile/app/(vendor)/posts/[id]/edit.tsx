import { router, Stack, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { PostForm, type PostFormValues } from '@/src/components/vendor/post-form';
import { supabase } from '@/src/lib/supabase';
import type { Post } from '@/src/types/database';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: queryError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (!data) setError('Post not found.');
      else setPost(data as Post);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave(values: PostFormValues) {
    if (!post) return;
    setSaving(true);
    setError(null);

    const update: Record<string, unknown> = {
      post_type: values.post_type,
      caption: values.caption,
      media_url: values.media_url,
      media_type: values.media_type,
      product_id: values.product_id,
      event_id: values.event_id,
    };
    if (values.publish_at) {
      // Scheduled to a (future) time.
      update.publish_at = values.publish_at;
    } else if (new Date(post.publish_at).getTime() > Date.now()) {
      // Was scheduled, vendor turned scheduling off -> publish now.
      update.publish_at = new Date().toISOString();
    }

    const { error: updError } = await supabase.from('posts').update(update).eq('id', id);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete post', 'This permanently removes the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delError } = await supabase.from('posts').delete().eq('id', id);
          if (delError) {
            setError(delError.message);
            return;
          }
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit post',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !post ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'Post not found.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
          <PostForm
            mediaKind={post.media_type}
            initial={{
              post_type: post.post_type,
              caption: post.caption,
              media_url: post.media_url,
              media_type: post.media_type,
              product_id: post.product_id,
              event_id: post.event_id,
              publish_at: post.publish_at,
            }}
            submitLabel="Save changes"
            loading={saving}
            onSubmit={handleSave}
            onDelete={confirmDelete}
          />
        </Screen>
      )}
    </>
  );
}
