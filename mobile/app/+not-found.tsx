import { Link, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found', ...rootedStackScreenOptions }} />
      <Screen centered>
        <Text variant="title" className="mb-3 text-center">
          This screen doesn&apos;t exist.
        </Text>
        <Link href="/" asChild>
          <Pressable className="mt-4 active:opacity-80">
            <Text className="text-base font-medium text-primary">Go to home</Text>
          </Pressable>
        </Link>
      </Screen>
    </>
  );
}
