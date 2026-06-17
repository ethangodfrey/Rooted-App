import { router, Stack, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { ProductForm, type ProductFormValues } from '@/src/components/vendor/product-form';
import { supabase } from '@/src/lib/supabase';
import type { Product } from '@/src/types/database';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: queryError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (!data) setError('Product not found.');
      else setProduct(data);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave(values: ProductFormValues) {
    setSaving(true);
    setError(null);
    const { error: updError } = await supabase
      .from('products')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete product', 'This permanently removes the product and its availability.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delError } = await supabase.from('products').delete().eq('id', id);
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
          title: 'Edit product',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : error && !product ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error}
          </Text>
        </Screen>
      ) : product ? (
        <Screen scroll>
          <Text variant="title" className="mb-6">
            {product.name}
          </Text>
          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          <ProductForm
            initial={product}
            submitLabel="Save changes"
            onSubmit={handleSave}
            loading={saving}
          />

          <View className="mt-4 gap-3">
            <Button
              label="Manage event availability"
              variant="secondary"
              onPress={() => router.push(`/(vendor)/products/${id}/availability`)}
            />
            <Button label="Delete product" variant="ghost" onPress={confirmDelete} />
          </View>
        </Screen>
      ) : null}
    </>
  );
}
