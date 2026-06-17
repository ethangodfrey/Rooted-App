import { router, Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useState } from 'react';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { PostForm, type PostFormValues } from '@/src/components/vendor/post-form';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

export default function NewVideoPostScreen() {
  const { vendor } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(values: PostFormValues) {
    if (!vendor) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('posts').insert({
      vendor_id: vendor.id,
      post_type: values.post_type,
      caption: values.caption,
      media_url: values.media_url,
      media_type: 'video',
      product_id: values.product_id,
      event_id: values.event_id,
      ...(values.publish_at ? { publish_at: values.publish_at } : {}),
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New video',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <PostForm
          mediaKind="video"
          submitLabel="Publish video"
          loading={saving}
          onSubmit={handleCreate}
        />
      </Screen>
    </>
  );
}
