import { useState } from 'react';
import { View } from 'react-native';

import { BrandImageField } from '@/src/components/vendor/brand-image-field';
import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { Input } from '@/src/components/ui/input';
import { TextArea } from '@/src/components/ui/text-area';
import { Text } from '@/src/components/ui/text';
import {
  PAYMENT_METHOD_OPTIONS,
  STOREFRONT_ACCENT_OPTIONS,
  type PaymentMethod,
  type StorefrontFormValues,
} from '@/src/lib/vendor-storefront';
import {
  SELLING_CHANNEL_OPTIONS,
  VENDOR_CATEGORY_OPTIONS,
  type SellingChannel,
} from '@/src/lib/vendor-application';
import { pickAndUploadVendorBrandImage } from '@/src/lib/upload';
import { colors } from '@/src/theme/colors';

interface StorefrontFormProps {
  initial: StorefrontFormValues;
  userId: string;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: StorefrontFormValues) => Promise<void> | void;
}

export function StorefrontForm({
  initial,
  userId,
  submitLabel,
  loading = false,
  onSubmit,
}: StorefrontFormProps) {
  const [values, setValues] = useState(initial);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof StorefrontFormValues>(key: K, value: StorefrontFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(option: SellingChannel) {
    setValues((prev) => ({
      ...prev,
      selling_channels: prev.selling_channels.includes(option)
        ? prev.selling_channels.filter((c) => c !== option)
        : [...prev.selling_channels, option],
    }));
  }

  function togglePayment(option: PaymentMethod) {
    setValues((prev) => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(option)
        ? prev.payment_methods.filter((m) => m !== option)
        : [...prev.payment_methods, option],
    }));
  }

  async function handleBrandUpload(kind: 'logo' | 'banner') {
    setError(null);
    const setUploading = kind === 'banner' ? setUploadingBanner : setUploadingLogo;
    setUploading(true);
    try {
      const url = await pickAndUploadVendorBrandImage(userId, kind);
      if (url) {
        patch(kind === 'banner' ? 'banner_url' : 'logo_url', url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View>
      <Text variant="heading" className="mb-3">
        Cover & logo
      </Text>
      <BrandImageField
        label="Banner image"
        hint="Wide cover photo shoppers see at the top of your page. Markets or product shots work well."
        imageUrl={values.banner_url}
        variant="banner"
        uploading={uploadingBanner}
        onPick={() => handleBrandUpload('banner')}
        onRemove={() => patch('banner_url', null)}
      />
      <BrandImageField
        label="Logo"
        hint="Square or round logo that sits over your banner."
        imageUrl={values.logo_url}
        variant="logo"
        uploading={uploadingLogo}
        onPick={() => handleBrandUpload('logo')}
        onRemove={() => patch('logo_url', null)}
      />

      <Text variant="heading" className="mb-3">
        Storefront header
      </Text>
      <Input
        label="Business name"
        value={values.business_name}
        onChangeText={(text) => patch('business_name', text)}
        placeholder="Rooted Bakehouse"
      />
      <Input
        label="Tagline"
        value={values.product_summary}
        onChangeText={(text) => patch('product_summary', text)}
        placeholder="Small-batch sourdough and weekend pastry boxes"
      />
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
        Category
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {VENDOR_CATEGORY_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={values.category === option}
            onPress={() => patch('category', values.category === option ? null : option)}
          />
        ))}
      </View>
      <Input
        label="Featured highlight (optional)"
        value={values.featured_highlight}
        onChangeText={(text) => patch('featured_highlight', text)}
        placeholder="e.g. New seasonal menu every month"
      />

      <Text variant="heading" className="mb-3">
        About
      </Text>
      <TextArea
        label="Your story"
        value={values.business_description}
        onChangeText={(text) => patch('business_description', text)}
        placeholder="Tell shoppers who you are, what you make, and what makes your goods special."
        minHeight={120}
      />

      <Text variant="heading" className="mb-3">
        Location & markets
      </Text>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input
            label="City"
            value={values.sell_city}
            onChangeText={(text) => patch('sell_city', text)}
            placeholder="Denver"
          />
        </View>
        <View style={{ width: 80 }}>
          <Input
            label="State"
            value={values.sell_state}
            onChangeText={(text) => patch('sell_state', text)}
            placeholder="CO"
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>
      <Input
        label="Main market or event"
        value={values.primary_market}
        onChangeText={(text) => patch('primary_market', text)}
        placeholder="Downtown Makers Market"
      />
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
        Where you sell
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {SELLING_CHANNEL_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={values.selling_channels.includes(option)}
            onPress={() => toggleChannel(option)}
          />
        ))}
      </View>

      <Text variant="heading" className="mb-3">
        Links
      </Text>
      <Input
        label="Instagram"
        value={values.instagram_url}
        onChangeText={(text) => patch('instagram_url', text)}
        placeholder="instagram.com/yourshop"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Input
        label="Website or shop"
        value={values.website_url}
        onChangeText={(text) => patch('website_url', text)}
        placeholder="yourshop.com"
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text variant="heading" className="mb-3">
        Shopper details
      </Text>
      <TextArea
        label="Pickup & ordering notes"
        value={values.pickup_info}
        onChangeText={(text) => patch('pickup_info', text)}
        placeholder="Reserve online, pay at pickup. Look for the green tent near the main entrance."
        minHeight={88}
      />
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
        Payment methods accepted
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {PAYMENT_METHOD_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={values.payment_methods.includes(option)}
            onPress={() => togglePayment(option)}
          />
        ))}
      </View>

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
        Accent color
      </Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        {STOREFRONT_ACCENT_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={values.accent_color === option.id}
            onPress={() => patch('accent_color', option.id)}
          />
        ))}
      </View>

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
      <Button
        label={submitLabel}
        loading={loading || uploadingBanner || uploadingLogo}
        onPress={() => onSubmit(values)}
      />
    </View>
  );
}
