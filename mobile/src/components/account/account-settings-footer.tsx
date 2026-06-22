import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { deleteOwnAccount } from '@/src/lib/delete-account';
import { getPrivacyPolicyUrl, getSupportUrl, getTermsOfServiceUrl } from '@/src/lib/legal-urls';

async function openLegalUrl(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

export function AccountSettingsFooter() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, orders, and saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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

    router.replace('/welcome');
  }

  return (
    <View className="mt-8">
      <Text variant="eyebrow" className="mb-3">
        Legal &amp; support
      </Text>
      <View className="mb-4 gap-2">
        <Button
          label="Privacy Policy"
          variant="secondary"
          onPress={() => openLegalUrl(getPrivacyPolicyUrl())}
        />
        <Button
          label="Terms of Service"
          variant="secondary"
          onPress={() => openLegalUrl(getTermsOfServiceUrl())}
        />
        <Button label="Support" variant="secondary" onPress={() => openLegalUrl(getSupportUrl())} />
      </View>

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <Button
        label={deleting ? 'Deleting…' : 'Delete my account'}
        variant="secondary"
        loading={deleting}
        onPress={confirmDelete}
      />
    </View>
  );
}
