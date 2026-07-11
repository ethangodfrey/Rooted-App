import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { deleteOwnAccount } from '@/src/lib/delete-account';
import {
  getPrivacyPolicyUrl,
  getSupportUrl,
  getTermsOfServiceUrl,
} from '@/src/lib/legal-urls';

interface AccountLegalSectionProps {
  onAccountDeleted?: () => void;
}

export function AccountLegalSection({ onAccountDeleted }: AccountLegalSectionProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your Rooted account, profile, and saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void handleDelete();
          },
        },
      ],
    );
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await deleteOwnAccount();
    setDeleting(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    onAccountDeleted?.();
  }

  return (
    <View className="mt-8">
      <Text variant="heading" className="mb-3">
        Legal & support
      </Text>
      <View className="mb-4 gap-2">
        <ExternalLink href={getPrivacyPolicyUrl()}>
          <Text className="text-sm font-medium text-primary">Privacy policy</Text>
        </ExternalLink>
        <ExternalLink href={getTermsOfServiceUrl()}>
          <Text className="text-sm font-medium text-primary">Terms of service</Text>
        </ExternalLink>
        <Pressable onPress={() => Linking.openURL(getSupportUrl())}>
          <Text className="text-sm font-medium text-primary">Contact support</Text>
        </Pressable>
      </View>

      <Text variant="caption" className="mb-3">
        You can permanently delete your account and associated data at any time.
      </Text>
      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
      <Button
        label="Delete my account"
        variant="secondary"
        loading={deleting}
        onPress={confirmDelete}
      />
    </View>
  );
}
