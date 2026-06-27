import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { ExploreContentForm, type LinkOption } from '@/src/components/explore/explore-content-form';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { createExploreContent, type ExploreContentInput } from '@/src/lib/explore-content';
import { supabase } from '@/src/lib/supabase';

export default function NewChefExplorePostScreen() {
  const { chef } = useAuth();
  const [services, setServices] = useState<LinkOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!chef?.id) return;
      const { data } = await supabase
        .from('chef_services')
        .select('id, service_name')
        .eq('chef_id', chef.id);
      if (!active) return;
      setServices(
        ((data as { id: string; service_name: string }[]) ?? []).map((s) => ({
          id: s.id,
          label: s.service_name,
        })),
      );
    }
    void load();
    return () => {
      active = false;
    };
  }, [chef?.id]);

  async function handleCreate(input: ExploreContentInput) {
    if (!chef?.id) return;
    setSaving(true);
    setError(null);
    try {
      await createExploreContent({ creatorType: 'chef', chefId: chef.id }, input);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish your post.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add to portfolio',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <ExploreContentForm
          creatorKind="chef"
          linkOptions={services}
          linkLabel="Link a service (optional)"
          submitLabel="Publish to Explore"
          loading={saving}
          onSubmit={handleCreate}
        />
      </Screen>
    </>
  );
}
