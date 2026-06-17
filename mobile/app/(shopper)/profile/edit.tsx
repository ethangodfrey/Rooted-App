import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useSavedVendors } from '@/src/hooks/use-saved-vendors';
import { updateShopperEmail, updateShopperProfile } from '@/src/lib/shopper-profile';
import { supabase } from '@/src/lib/supabase';
import { pickAndUploadProfilePhoto } from '@/src/lib/upload';
import { colors } from '@/src/theme/colors';

interface SavedVendor {
  id: string;
  business_name: string | null;
  category: string | null;
}

export default function ShopperProfileEditScreen() {
  const { user, session, refreshUser } = useAuth();
  const { saved, remove, pending: savedPending } = useSavedVendors();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? session?.user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo ?? '');
  const [vendors, setVendors] = useState<SavedVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? session?.user?.email ?? '');
    setPhone(user?.phone ?? '');
    setPhotoUrl(user?.profile_photo ?? '');
  }, [user, session?.user?.email]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (saved.length === 0) {
        setVendors([]);
        return;
      }
      setLoadingVendors(true);
      const { data } = await supabase
        .from('vendors')
        .select('id, business_name, category')
        .in('id', saved);
      if (!active) return;
      setVendors((data as SavedVendor[]) ?? []);
      setLoadingVendors(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [saved]);

  async function handlePickPhoto() {
    if (!user) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await pickAndUploadProfilePhoto(user.id);
      if (url) setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const profileResult = await updateShopperProfile(user.id, {
      name,
      phone,
      profile_photo: photoUrl || null,
    });

    if (profileResult.error) {
      setSaving(false);
      setError(profileResult.error);
      return;
    }

    const currentEmail = user.email ?? session?.user?.email ?? '';
    if (email.trim() && email.trim() !== currentEmail) {
      const emailResult = await updateShopperEmail(email);
      if (emailResult.error) {
        setSaving(false);
        setError(emailResult.error);
        return;
      }
      if (emailResult.confirmationRequired) {
        setMessage('Profile saved. Check your inbox to confirm your new email address.');
      }
    }

    await refreshUser();
    setSaving(false);

    if (!message) {
      router.back();
    }
  }

  function handleRemoveVendor(vendor: SavedVendor) {
    Alert.alert(
      'Remove saved vendor?',
      `Stop following ${vendor.business_name ?? 'this vendor'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => remove(vendor.id),
        },
      ],
    );
  }

  const initials = (name || email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit profile',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="eyebrow" className="mb-2">
          Your account
        </Text>
        <Text variant="subtitle" className="mb-6">
          Update your photo, contact info, and saved vendors.
        </Text>

        <View className="mb-6 items-center">
          <Pressable
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo">
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            ) : (
              <View
                className="h-24 w-24 items-center justify-center rounded-full bg-honeydew"
                style={{ borderWidth: 2, borderColor: colors.primary }}>
                <Text variant="title" style={{ color: colors.primary }}>
                  {initials}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} className="mt-3">
            {uploadingPhoto ? (
              <LoadingIndicator size="small" />
            ) : (
              <Text className="text-sm font-medium text-primary">Change photo</Text>
            )}
          </Pressable>
          {photoUrl ? (
            <Pressable onPress={() => setPhotoUrl('')} className="mt-2">
              <Text className="text-xs text-muted">Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Text variant="caption" className="-mt-1 mb-3">
          Changing your email may require confirmation via inbox.
        </Text>
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="(555) 555-5555"
        />

        <Text variant="heading" className="mb-3 mt-2">
          Saved vendors
        </Text>
        {loadingVendors ? (
          <LoadingIndicator />
        ) : vendors.length === 0 ? (
          <Text variant="caption" className="mb-4">
            Vendors you heart appear here. Save one from their storefront to follow them.
          </Text>
        ) : (
          <View className="mb-4 gap-3">
            {vendors.map((vendor) => (
              <Card key={vendor.id} className="flex-row items-center px-4 py-3.5">
                <Pressable
                  className="min-w-0 flex-1 flex-row items-center"
                  onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}>
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
                    <FontAwesome name="shopping-bag" size={18} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1 pr-2">
                    <Text variant="body" className="font-semibold">
                      {vendor.business_name ?? 'Vendor'}
                    </Text>
                    {vendor.category ? (
                      <Text variant="caption" className="mt-0.5">
                        {vendor.category}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => handleRemoveVendor(vendor)}
                  disabled={savedPending}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${vendor.business_name ?? 'vendor'}`}>
                  <FontAwesome name="heart" size={20} color="#bc4749" />
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        {message ? <Text className="mb-3 text-sm text-primary">{message}</Text> : null}

        <View className="mt-2">
          <Button label="Save changes" loading={saving} onPress={handleSave} />
        </View>
      </Screen>
    </>
  );
}
