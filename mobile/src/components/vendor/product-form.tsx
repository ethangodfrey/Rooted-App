import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useState } from 'react';
import { Image, Pressable, Switch, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { TextArea } from '@/src/components/ui/text-area';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { pickAndUploadProductImage } from '@/src/lib/upload';

export interface ProductFormValues {
  name: string;
  description: string | null;
  price: number; // cents
  category: string | null;
  reserve_enabled: boolean;
  reserve_limit_total: number | null;
  reserve_limit_per_shopper: number | null;
  media_urls: string[];
}

interface ProductFormProps {
  initial?: Partial<{
    name: string;
    description: string | null;
    price: number; // cents
    category: string | null;
    reserve_enabled: boolean;
    reserve_limit_total: number | null;
    reserve_limit_per_shopper: number | null;
    media_urls: string[];
  }>;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  loading?: boolean;
}

/** Parses an optional positive-integer limit. Returns null when blank,
 * 'invalid' on bad input, or the parsed number. */
function parseOptionalLimit(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return 'invalid';
  return value;
}

export function ProductForm({ initial, submitLabel, onSubmit, loading = false }: ProductFormProps) {
  const { user } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceText, setPriceText] = useState(
    initial?.price != null ? (initial.price / 100).toFixed(2) : '',
  );
  const [category, setCategory] = useState(initial?.category ?? '');
  const [reserveEnabled, setReserveEnabled] = useState(initial?.reserve_enabled ?? true);
  const [limitTotal, setLimitTotal] = useState(
    initial?.reserve_limit_total != null ? String(initial.reserve_limit_total) : '',
  );
  const [limitPerShopper, setLimitPerShopper] = useState(
    initial?.reserve_limit_per_shopper != null ? String(initial.reserve_limit_per_shopper) : '',
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>(initial?.media_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPhoto() {
    if (!user) {
      setError('You must be signed in to add photos.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadProductImage(user.id);
      if (url) {
        setMediaUrls((prev) => [...prev, url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    const priceValue = Number.parseFloat(priceText);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('Enter a valid price (e.g. 12.50).');
      return;
    }

    let limitTotalValue: number | null = null;
    let limitPerShopperValue: number | null = null;
    if (reserveEnabled) {
      const parsed = parseOptionalLimit(limitTotal);
      if (parsed === 'invalid') {
        setError('Reservation limit must be a whole number of 1 or more.');
        return;
      }
      limitTotalValue = parsed;

      const parsedPer = parseOptionalLimit(limitPerShopper);
      if (parsedPer === 'invalid') {
        setError('Per-shopper limit must be a whole number of 1 or more.');
        return;
      }
      limitPerShopperValue = parsedPer;

      if (limitTotalValue != null && limitPerShopperValue != null && limitPerShopperValue > limitTotalValue) {
        setError('Per-shopper limit cannot exceed the total reservation limit.');
        return;
      }
    }

    setError(null);
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(priceValue * 100),
      category: category.trim() || null,
      reserve_enabled: reserveEnabled,
      reserve_limit_total: limitTotalValue,
      reserve_limit_per_shopper: limitPerShopperValue,
      media_urls: mediaUrls,
    });
  }

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-ink">Photos</Text>
      <View className="mb-4 flex-row flex-wrap gap-3">
        {mediaUrls.map((url) => (
          <View key={url} className="relative">
            <Image source={{ uri: url }} className="h-20 w-20 rounded-xl bg-line" />
            <Pressable
              onPress={() => removePhoto(url)}
              className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink"
              accessibilityLabel="Remove photo">
              <FontAwesome name="times" size={12} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={handleAddPhoto}
          disabled={uploading}
          className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-subtle bg-white">
          {uploading ? (
            <LoadingIndicator />
          ) : (
            <FontAwesome name="camera" size={20} color="#228B22" />
          )}
        </Pressable>
      </View>

      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Sourdough loaf"
        autoCapitalize="words"
      />

      <TextArea
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the product..."
        minHeight={96}
      />

      <Input
        label="Price (USD)"
        value={priceText}
        onChangeText={setPriceText}
        placeholder="12.50"
        keyboardType="decimal-pad"
      />

      <Input
        label="Category"
        value={category}
        onChangeText={setCategory}
        placeholder="Baked Goods"
        autoCapitalize="words"
      />

      <View className="mb-4 px-3.5 py-3" style={inputBorderStyle()}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text variant="body" className="font-semibold">
              Allow reservations
            </Text>
            <Text variant="caption" className="mt-0.5">
              Let shoppers reserve this for pickup at events.
            </Text>
          </View>
          <Switch
            value={reserveEnabled}
            onValueChange={setReserveEnabled}
            trackColor={{ true: '#228B22', false: '#E5E7EB' }}
            thumbColor="#ffffff"
          />
        </View>

        {reserveEnabled ? (
          <View className="mt-4 border-t border-honeydew pt-4">
            <Input
              label="Total reservation limit"
              value={limitTotal}
              onChangeText={setLimitTotal}
              placeholder="No limit"
              keyboardType="number-pad"
            />
            <Text variant="caption" className="-mt-2 mb-2">
              How many units to offer for reservation in total. Leave blank for no cap.
            </Text>

            <Input
              label="Max per shopper"
              value={limitPerShopper}
              onChangeText={setLimitPerShopper}
              placeholder="No limit"
              keyboardType="number-pad"
            />
            <Text variant="caption" className="mt-1">
              Most units a single shopper can reserve. Leave blank for no cap.
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <Button label={submitLabel} loading={loading} onPress={handleSubmit} />
    </View>
  );
}
