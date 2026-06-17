import { router } from 'expo-router';
import { View } from 'react-native';

import { ActionRow } from '@/src/components/ui/action-row';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';

export default function VendorMoreScreen() {
  const { user, vendor, signOut } = useAuth();

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Account
      </Text>
      <Text variant="title" className="mb-6">
        Profile
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
          icon="paint-brush"
          title="Edit storefront"
          subtitle="Banner, logo, about section, links, and shopper details."
          onPress={() => router.push('/(vendor)/profile/storefront')}
        />
        {vendor ? (
          <ActionRow
            icon="eye"
            title="Preview shop page"
            subtitle="See how shoppers will view your storefront."
            onPress={() => router.push('/(vendor)/profile/preview')}
          />
        ) : null}
        <ActionRow
          icon="file-text-o"
          title="Application details"
          subtitle="Update business info from your original application."
          onPress={() => router.push('/(vendor)/profile/setup')}
        />
      </View>

      <View className="mt-2">
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}
