import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { Input } from '@/src/components/ui/input';
import { TextArea } from '@/src/components/ui/text-area';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { resetRoleSelection } from '@/src/lib/reset-role-selection';
import { supabase } from '@/src/lib/supabase';
import {
  normalizeUrl,
  SELLING_CHANNEL_OPTIONS,
  validateVendorApplication,
  VENDOR_CATEGORY_OPTIONS,
  type SellingChannel,
} from '@/src/lib/vendor-application';

export default function VendorSetupScreen() {
  const { session, vendor, refreshUser } = useAuth();
  const [businessName, setBusinessName] = useState(vendor?.business_name ?? '');
  const [productSummary, setProductSummary] = useState(vendor?.product_summary ?? '');
  const [description, setDescription] = useState(vendor?.business_description ?? '');
  const [category, setCategory] = useState<string | null>(vendor?.category ?? null);
  const [sellCity, setSellCity] = useState(vendor?.sell_city ?? '');
  const [sellState, setSellState] = useState(vendor?.sell_state ?? '');
  const [channels, setChannels] = useState<SellingChannel[]>(
    (vendor?.selling_channels as SellingChannel[]) ?? [],
  );
  const [primaryMarket, setPrimaryMarket] = useState(vendor?.primary_market ?? '');
  const [instagram, setInstagram] = useState(vendor?.instagram_url ?? '');
  const [website, setWebsite] = useState(vendor?.website_url ?? '');
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(option: SellingChannel) {
    setChannels((prev) =>
      prev.includes(option) ? prev.filter((c) => c !== option) : [...prev, option],
    );
  }

  async function handleSave() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    const application = {
      business_name: businessName,
      product_summary: productSummary,
      business_description: description.trim() || null,
      category: category ?? '',
      sell_city: sellCity,
      sell_state: sellState,
      selling_channels: channels,
      primary_market: primaryMarket.trim() || null,
      instagram_url: normalizeUrl(instagram),
      website_url: normalizeUrl(website),
    };

    const validationError = validateVendorApplication(application, attested);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const now = new Date().toISOString();
    const { error: vendorError } = await supabase
      .from('vendors')
      .update({
        business_name: application.business_name.trim(),
        product_summary: application.product_summary.trim(),
        business_description: application.business_description,
        category: application.category,
        sell_city: application.sell_city.trim(),
        sell_state: application.sell_state.trim().toUpperCase(),
        selling_channels: application.selling_channels,
        primary_market: application.primary_market,
        instagram_url: application.instagram_url,
        website_url: application.website_url,
        application_submitted_at: now,
        updated_at: now,
      })
      .eq('user_id', session.user.id);

    if (vendorError) {
      setLoading(false);
      setError(vendorError.message);
      return;
    }

    await refreshUser();
    setLoading(false);
    router.replace('/');
  }

  async function handleBack() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setBacking(true);
    setError(null);

    const { error: resetError } = await resetRoleSelection(session.user.id, 'vendor');

    setBacking(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    await refreshUser();
    router.replace('/(onboarding)/role-select');
  }

  return (
    <Screen scroll>
      <BackButton onPress={handleBack} loading={backing} disabled={loading} />

      <Text variant="eyebrow" className="mb-2">
        Vendor application
      </Text>
      <Text variant="title" className="mb-2">
        Tell us about your business
      </Text>
      <Text variant="subtitle" className="mb-6">
        Rooted is for local makers and market vendors. We review every application before your
        storefront goes live.
      </Text>

      <Text variant="heading" className="mb-3">
        What you sell
      </Text>

      <Input
        label="Business name"
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Rooted Bakehouse"
        autoCapitalize="words"
      />

      <Input
        label="What do you sell?"
        value={productSummary}
        onChangeText={setProductSummary}
        placeholder="Sourdough bread, cookies, and weekend pastry boxes"
      />

      <Text className="mb-2 text-sm font-semibold text-ink">Category</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {VENDOR_CATEGORY_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={category === option}
            onPress={() => setCategory((prev) => (prev === option ? null : option))}
          />
        ))}
      </View>

      <TextArea
        label="More detail (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Ingredients, materials, or what makes your goods special"
        minHeight={80}
      />

      <Text variant="heading" className="mb-3">
        Where you sell
      </Text>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input label="City" value={sellCity} onChangeText={setSellCity} placeholder="Austin" />
        </View>
        <View className="w-20">
          <Input
            label="State"
            value={sellState}
            onChangeText={setSellState}
            placeholder="TX"
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>

      <Text className="mb-2 text-sm font-semibold text-ink">Where do you usually sell?</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {SELLING_CHANNEL_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={channels.includes(option)}
            onPress={() => toggleChannel(option)}
          />
        ))}
      </View>

      <Input
        label="Main market or event (optional)"
        value={primaryMarket}
        onChangeText={setPrimaryMarket}
        placeholder="e.g. Downtown Makers Market"
      />

      <Text variant="heading" className="mb-3">
        Verify your business
      </Text>
      <Text variant="caption" className="mb-4">
        Add Instagram or a website so our team can confirm you&apos;re an active local vendor. This
        is a quick manual check — not a formal license review.
      </Text>

      <Input
        label="Instagram"
        value={instagram}
        onChangeText={setInstagram}
        placeholder="instagram.com/yourshop"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Input
        label="Website or shop link"
        value={website}
        onChangeText={setWebsite}
        placeholder="yourshop.com or Etsy link"
        autoCapitalize="none"
        keyboardType="url"
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: attested }}
        className="mb-4 flex-row gap-3 rounded-card bg-honeydew p-4"
        onPress={() => setAttested((prev) => !prev)}>
        <Text className="text-lg">{attested ? '☑' : '☐'}</Text>
        <Text variant="caption" className="flex-1">
          I sell handmade, vintage, or locally made goods at markets, fairs, or community events —
          not a national retail chain or drop-ship reseller.
        </Text>
      </Pressable>

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <View className="mt-2">
        <Button
          label="Submit application"
          loading={loading}
          disabled={backing}
          onPress={handleSave}
        />
      </View>

      <Text variant="caption" className="mt-4 text-center">
        An admin will review your application before shoppers can see your storefront.
      </Text>
    </Screen>
  );
}
