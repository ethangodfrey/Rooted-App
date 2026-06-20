import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { DeleteAccountSection } from '@/src/components/account/delete-account-section';
import { ActionRow } from '@/src/components/ui/action-row';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useSavedVendors } from '@/src/hooks/use-saved-vendors';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';

interface SavedVendor {
  id: string;
  business_name: string | null;
  category: string | null;
}

export default function ShopperProfileScreen() {
  const { user, session, signOut } = useAuth();
  const { saved } = useSavedVendors();
  const [vendors, setVendors] = useState<SavedVendor[]>([]);
  const [loading, setLoading] = useState(false);

  const displayEmail = user?.email ?? session?.user?.email ?? '—';
  const initials = (user?.name || displayEmail || '?').toString().trim().charAt(0).toUpperCase();

  useEffect(() => {
    let active = true;
    async function load() {
      if (saved.length === 0) {
        setVendors([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('vendors')
        .select('id, business_name, category')
        .in('id', saved);
      if (!active) return;
      setVendors((data as SavedVendor[]) ?? []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [saved]);

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Account
      </Text>
      <Text variant="title" className="mb-6">
        Profile
      </Text>

      <Card className="mb-4">
        <View className="flex-row items-center">
          {user?.profile_photo ? (
            <Image
              source={{ uri: user.profile_photo }}
              style={{ width: 56, height: 56, borderRadius: 28, marginRight: 14 }}
            />
          ) : (
            <View className="mr-3.5 h-14 w-14 items-center justify-center rounded-full bg-honeydew">
              <Text variant="heading" style={{ color: colors.primary }}>
                {initials}
              </Text>
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Text variant="body" className="font-semibold">
              {user?.name?.trim() || 'Shopper'}
            </Text>
            <Text variant="caption" className="mt-0.5">
              {displayEmail}
            </Text>
            {user?.phone ? (
              <Text variant="caption" className="mt-0.5">
                {user.phone}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="mt-4">
          <Button
            label="Edit profile"
            variant="secondary"
            onPress={() => router.push('/(shopper)/profile/edit')}
          />
        </View>
      </Card>

      <View className="mb-6">
        <ActionRow
          icon="shopping-basket"
          title="My reservations"
          subtitle="Track your reserve-for-pickup orders."
          onPress={() => router.push('/(shopper)/orders')}
        />
      </View>

      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="heading">Saved vendors</Text>
        {vendors.length > 0 ? (
          <Pressable onPress={() => router.push('/(shopper)/profile/edit')}>
            <Text className="text-sm font-medium text-primary">Manage</Text>
          </Pressable>
        ) : null}
      </View>
      {loading ? (
        <LoadingIndicator />
      ) : vendors.length === 0 ? (
        <Text variant="caption" className="mb-6">
          Tap the heart on a vendor&apos;s page to save them here.
        </Text>
      ) : (
        <View className="mb-6 gap-3">
          {vendors.slice(0, 5).map((vendor) => (
            <Pressable
              key={vendor.id}
              onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}>
              <Card className="flex-row items-center px-4 py-3.5">
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
                <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
              </Card>
            </Pressable>
          ))}
          {vendors.length > 5 ? (
            <Pressable onPress={() => router.push('/(shopper)/profile/edit')}>
              <Text className="text-center text-sm font-medium text-primary">
                View all {vendors.length} saved vendors
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View className="mt-2">
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>

      <View className="mt-8 border-t border-honeydew pt-6">
        <DeleteAccountSection />
      </View>
    </Screen>
  );
}
