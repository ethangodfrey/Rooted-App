import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';

export default function ChefDashboardScreen() {
  const { chef } = useAuth();

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-1">
        Chef dashboard
      </Text>
      <Text variant="title" className="mb-2">
        Welcome, {chef?.display_name ?? 'Chef'}
      </Text>
      <Text variant="subtitle" className="mb-6">
        Manage services, respond to booking inquiries, and showcase your work.
      </Text>

      <Card className="mb-4">
        <Text variant="heading" className="mb-1">
          Approval status
        </Text>
        <Text variant="body">
          {chef?.approval_status === 'approved'
            ? 'Your chef profile is live.'
            : 'Your profile is pending admin review.'}
        </Text>
      </Card>

      <View className="gap-3">
        <PressableCard onPress={() => router.push('/(chef)/services/create')}>
          <Text variant="heading">Add a service</Text>
          <Text variant="caption">Private dining, meal prep, catering, and more.</Text>
        </PressableCard>
        <PressableCard onPress={() => router.push('/(chef)/(tabs)/bookings')}>
          <Text variant="heading">View bookings</Text>
          <Text variant="caption">Respond to inquiries and send quotes.</Text>
        </PressableCard>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(chef)/(tabs)/portfolio')}>
          <PressableCard>
            <Text variant="heading">Update portfolio</Text>
            <Text variant="caption">Showcase dishes and past events.</Text>
          </PressableCard>
        </Pressable>
      </View>
    </Screen>
  );
}
