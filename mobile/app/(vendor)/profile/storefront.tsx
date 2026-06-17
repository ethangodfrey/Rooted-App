import { router, Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { StorefrontForm } from '@/src/components/vendor/storefront-form';
import { useAuth } from '@/src/hooks/use-auth';
import {
  storefrontUpdatePayload,
  storefrontValuesFromVendor,
  validateStorefront,
  type StorefrontFormValues,
} from '@/src/lib/vendor-storefront';
import { supabase } from '@/src/lib/supabase';

export default function VendorStorefrontEditScreen() {
  const { user, vendor, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(
    () => (vendor ? storefrontValuesFromVendor(vendor) : null),
    [vendor],
  );

  async function handleSave(values: StorefrontFormValues) {
    if (!user || !vendor) return;

    const validationError = validateStorefront(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('vendors')
      .update(storefrontUpdatePayload(values))
      .eq('user_id', user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refreshUser();
    router.back();
  }

  if (!vendor || !initial) {
    return (
      <Screen centered>
        <Text variant="subtitle">Vendor profile not found.</Text>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit storefront',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="eyebrow" className="mb-2">
          Your shop page
        </Text>
        <Text variant="title" className="mb-2">
          Customize storefront
        </Text>
        <Text variant="subtitle" className="mb-6">
          Shoppers see this top-to-bottom on your vendor page — banner, story, links, and details.
        </Text>

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

        <StorefrontForm
          initial={initial}
          userId={user!.id}
          submitLabel="Save storefront"
          loading={saving}
          onSubmit={handleSave}
        />

        <View className="mt-4">
          <Button
            label="Preview shop page"
            variant="secondary"
            onPress={() => router.push('/(vendor)/profile/preview')}
          />
        </View>
      </Screen>
    </>
  );
}
