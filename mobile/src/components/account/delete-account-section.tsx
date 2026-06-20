import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { deleteOwnAccount } from '@/src/lib/delete-account';

export function DeleteAccountSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your Rooted account, profile, and saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ],
    );
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const { error: deleteError } = await deleteOwnAccount();
    setLoading(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    router.replace('/(auth)/login');
  }

  return (
    <>
      <Button label="Delete account" variant="danger" loading={loading} onPress={confirmDelete} />
      {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
      <Text variant="caption" className="mt-2">
        Permanently removes your account and profile data.
      </Text>
    </>
  );
}
