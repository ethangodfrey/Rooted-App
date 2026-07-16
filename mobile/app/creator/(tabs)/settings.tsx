import { router } from 'expo-router';
import { View } from 'react-native';

import { ActionRow } from '@/src/components/ui/action-row';
import { DeleteAccountButton } from '@/src/components/account/delete-account-button';
import { LegalLinks } from '@/src/components/account/legal-links';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';

export default function CreatorSettingsScreen() {
  const { user, vendor, signOut } = useAuth();

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Creator
      </Text>
      <Text variant="title" className="mb-6">
        Settings
      </Text>

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Email
        </Text>
        <Text variant="body" className="mb-4">
          {user?.email ?? '—'}
        </Text>
        <Text variant="caption" className="mb-1">
          Business
        </Text>
        <Text variant="body">{vendor?.business_name ?? 'Not set up yet'}</Text>
      </Card>

      <View className="mb-4 gap-3">
        <ActionRow
          icon="credit-card"
          title="Stripe payouts & SNAP / EBT"
          subtitle="Connect payouts and toggle SNAP discovery (web settings for full Connect flow)."
          onPress={() => router.push('/(vendor)/profile/storefront')}
        />
        <ActionRow
          icon="map-marker"
          title="Meetup & delivery rules"
          subtitle="Pickup notes, location, and shipping on your storefront."
          onPress={() => router.push('/(vendor)/profile/storefront')}
        />
        <ActionRow
          icon="shield"
          title="Compliance & credentials"
          subtitle="Cottage food requirements, permits, and trust badges."
          onPress={() => router.push('/(vendor)/compliance')}
        />
        <ActionRow
          icon="paint-brush"
          title="Edit storefront"
          subtitle="Banner, logo, about section, and shopper details."
          onPress={() => router.push('/(vendor)/profile/storefront')}
        />
      </View>

      <View className="mt-2 gap-3">
        <Button
          label="🔄 Back to Shopping"
          onPress={() => router.push('/(shopper)/(tabs)/')}
        />
        <Button label="Sign out" variant="secondary" onPress={signOut} />
        <DeleteAccountButton />
      </View>

      <LegalLinks />
    </Screen>
  );
}
