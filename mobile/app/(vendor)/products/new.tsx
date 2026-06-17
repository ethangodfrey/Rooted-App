import { router, Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useState } from 'react';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { ProductForm, type ProductFormValues } from '@/src/components/vendor/product-form';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

export default function NewProductScreen() {
  const { vendor } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(values: ProductFormValues) {
    if (!vendor) {
      setError('Vendor profile not found.');
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: insError } = await supabase
      .from('products')
      .insert({ ...values, vendor_id: vendor.id })
      .select('id')
      .single();

    setLoading(false);

    if (insError) {
      setError(insError.message);
      return;
    }

    // Go straight to edit so the vendor can set event availability.
    router.replace(`/(vendor)/products/${data.id}/edit`);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New product',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="title" className="mb-6">
          Add a product
        </Text>
        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <ProductForm submitLabel="Create product" onSubmit={handleCreate} loading={loading} />
      </Screen>
    </>
  );
}
