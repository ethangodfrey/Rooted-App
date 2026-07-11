import { router } from 'expo-router';

import { PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';

export default function ChefProfileTabScreen() {
  const { chef, signOut } = useAuth();

  return (
    <Screen scroll>
      <Text variant="title" className="mb-2">
        {chef?.display_name ?? 'Chef profile'}
      </Text>
      <Text variant="subtitle" className="mb-6">
        {chef?.home_base_city}, {chef?.home_base_state}
      </Text>

      <PressableCard className="mb-3" onPress={() => router.push('/(chef)/profile/setup')}>
        <Text variant="heading">Edit profile</Text>
      </PressableCard>

      <PressableCard className="mb-3" onPress={() => router.push('/(chef)/credentials')}>
        <Text variant="heading">Verification credentials</Text>
        <Text variant="caption">Upload certifications and permits to earn trust badges.</Text>
      </PressableCard>

      <PressableCard onPress={() => void signOut()}>
        <Text variant="heading">Sign out</Text>
      </PressableCard>
    </Screen>
  );
}
