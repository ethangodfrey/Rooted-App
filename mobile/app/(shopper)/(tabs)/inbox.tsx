import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';

/**
 * Unified inbox — replaces segmented shopper/vendor message routes.
 */
export default function ShopperInboxScreen() {
  return (
    <Screen scroll>
      <Text variant="title" className="mb-2">
        Inbox
      </Text>
      <Text variant="caption" className="mb-8">
        Messages with creators, market hosts, and support — all in one place.
      </Text>

      <View className="mb-6 rounded-2xl border border-border bg-surface px-5 py-6">
        <Text variant="body" className="mb-2 font-semibold">
          No conversations yet
        </Text>
        <Text variant="caption">
          When a creator replies to an inquiry or order question, it will show up here.
        </Text>
      </View>

      <View className="gap-3">
        <Button label="Browse Explore" onPress={() => router.push('/(shopper)/(tabs)/')} />
        <Button
          label="View orders"
          variant="secondary"
          onPress={() => router.push('/(shopper)/(tabs)/orders')}
        />
      </View>
    </Screen>
  );
}
