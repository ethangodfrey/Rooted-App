import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { ExploreContentForm, type LinkOption } from '@/src/components/explore/explore-content-form';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { createExploreContent, type ExploreContentInput } from '@/src/lib/explore-content';
import { supabase } from '@/src/lib/supabase';

export default function NewVendorExplorePostScreen() {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<LinkOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!vendor?.id) return;
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('vendor_id', vendor.id)
        .eq('status', 'active');
      if (!active) return;
      setProducts(
        ((data as { id: string; name: string }[]) ?? []).map((p) => ({
          id: p.id,
          label: p.name,
        })),
      );
    }
    void load();
    return () => {
      active = false;
    };
  }, [vendor?.id]);

  async function handleCreate(input: ExploreContentInput) {
    if (!vendor?.id) return;
    setSaving(true);
    setError(null);
    try {
      await createExploreContent({ creatorType: 'vendor', vendorId: vendor.id }, input);
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
          title: 'New showcase post',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <ExploreContentForm
          creatorKind="vendor"
          linkOptions={products}
          linkLabel="Link a product (optional)"
          submitLabel="Publish to Explore"
          loading={saving}
          onSubmit={handleCreate}
        />
      </Screen>
    </>
  );
}
