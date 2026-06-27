import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

export default function CreateChefServiceScreen() {
  const { chef } = useAuth();
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!chef?.id) return;
    const priceCents = Math.round(Number(basePrice) * 100);
    if (!serviceName.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      setError('Enter a service name and valid price.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('chef_services').insert({
      chef_id: chef.id,
      service_name: serviceName.trim(),
      service_type: 'custom',
      description: description.trim() || null,
      base_price: priceCents,
      price_type: 'flat_rate',
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.back();
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <Text variant="title" className="mb-6">
        New service
      </Text>

      <View className="gap-4">
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Service name"
          value={serviceName}
          onChangeText={setServiceName}
        />
        <TextInput
          className="min-h-[100px] rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Description"
          multiline
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Base price (USD)"
          keyboardType="decimal-pad"
          value={basePrice}
          onChangeText={setBasePrice}
        />
      </View>

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}

      <Button className="mt-6" label="Create service" onPress={handleSave} loading={saving} />
    </Screen>
  );
}
