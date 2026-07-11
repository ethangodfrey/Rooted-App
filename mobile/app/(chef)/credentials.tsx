import { router } from 'expo-router';

import { CredentialManager } from '@/src/components/trust/credential-manager';
import { BackButton } from '@/src/components/ui/back-button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';

export default function ChefCredentialsScreen() {
  const { user } = useAuth();

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <Text variant="title" className="mb-2">
        Verification credentials
      </Text>
      <Text variant="subtitle" className="mb-6">
        Upload your food safety certification, permits, and insurance. Verified credentials earn
        trust badges shown to customers.
      </Text>

      {user?.id ? (
        <CredentialManager userId={user.id} />
      ) : (
        <Card>
          <Text variant="body">Sign in to manage your credentials.</Text>
        </Card>
      )}
    </Screen>
  );
}
