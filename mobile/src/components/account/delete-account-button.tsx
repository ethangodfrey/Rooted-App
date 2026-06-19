import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { deleteOwnAccount } from '@/src/lib/delete-account';

export function DeleteAccountButton() {
  const [loading, setLoading] = useState(false);

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
    );
  }

  async function handleDelete() {
    setLoading(true);
    const { error } = await deleteOwnAccount();
    setLoading(false);

    if (error) {
      Alert.alert('Could not delete account', error);
      return;
    }

    router.replace('/(auth)/login');
  }

  return (
    <Button
      label="Delete account"
      variant="secondary"
      loading={loading}
      onPress={confirmDelete}
    />
  );
}
