import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { BrandImageField } from '@/src/components/vendor/brand-image-field';
import { useAuth } from '@/src/hooks/use-auth';
import { geocodeAddress } from '@/src/lib/geocode';
import { supabase } from '@/src/lib/supabase';
import { pickAndUploadProfilePhoto, pickAndUploadVendorBrandImage } from '@/src/lib/upload';

export default function ChefProfileSetupScreen() {
  const { user, chef, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(chef?.display_name ?? '');
  const [bio, setBio] = useState(chef?.bio ?? '');
  const [streetAddress, setStreetAddress] = useState(chef?.street_address ?? '');
  const [city, setCity] = useState(chef?.home_base_city ?? '');
  const [state, setState] = useState(chef?.home_base_state ?? '');
  const [postalCode, setPostalCode] = useState(chef?.postal_code ?? '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(chef?.profile_photo_url ?? null);
  const [bannerUrl, setBannerUrl] = useState(chef?.banner_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoUpload() {
    if (!user?.id) return;
    setError(null);
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadProfilePhoto(user.id);
      if (url) setProfilePhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleBannerUpload() {
    if (!user?.id) return;
    setError(null);
    setUploadingBanner(true);
    try {
      const url = await pickAndUploadVendorBrandImage(user.id, 'banner');
      if (url) setBannerUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner.');
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSave() {
    if (!chef?.id) return;
    setSaving(true);
    setError(null);

    const cleanStreet = streetAddress.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim().toUpperCase();
    const cleanPostal = postalCode.trim();

    // Best-effort geocode so the chef is geo-ranked in nearby/search. Falls back
    // to a city/state centroid and never blocks the save on failure.
    const coords = await geocodeAddress({
      streetAddress: cleanStreet,
      city: cleanCity,
      state: cleanState,
      postalCode: cleanPostal,
      country: 'USA',
    });

    const { error: updateError } = await supabase
      .from('chefs')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        street_address: cleanStreet || null,
        home_base_city: cleanCity,
        home_base_state: cleanState,
        postal_code: cleanPostal || null,
        country: 'USA',
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        profile_photo_url: profilePhotoUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chef.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refreshUser();
    router.replace('/(chef)/(tabs)/dashboard');
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <Text variant="title" className="mb-2">
        Set up your chef profile
      </Text>
      <Text variant="subtitle" className="mb-6">
        Tell customers about your culinary style and where you serve.
      </Text>

      <BrandImageField
        label="Banner image"
        hint="Wide cover photo customers see at the top of your chef page."
        imageUrl={bannerUrl}
        variant="banner"
        uploading={uploadingBanner}
        onPick={handleBannerUpload}
        onRemove={() => setBannerUrl(null)}
      />
      <BrandImageField
        label="Profile photo"
        hint="A clear headshot or logo that represents you."
        imageUrl={profilePhotoUrl}
        variant="logo"
        uploading={uploadingPhoto}
        onPick={handlePhotoUpload}
        onRemove={() => setProfilePhotoUrl(null)}
      />

      <View className="gap-4">
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          className="min-h-[100px] rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Bio"
          multiline
          value={bio}
          onChangeText={setBio}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Street address (optional)"
          value={streetAddress}
          onChangeText={setStreetAddress}
          textContentType="streetAddressLine1"
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="City"
          value={city}
          onChangeText={setCity}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="State"
          autoCapitalize="characters"
          maxLength={2}
          value={state}
          onChangeText={setState}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="ZIP code (optional)"
          keyboardType="number-pad"
          maxLength={10}
          value={postalCode}
          onChangeText={setPostalCode}
          textContentType="postalCode"
        />
      </View>

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}

      <Button
        className="mt-6"
        label="Save profile"
        onPress={handleSave}
        loading={saving || uploadingPhoto || uploadingBanner}
      />
    </Screen>
  );
}
