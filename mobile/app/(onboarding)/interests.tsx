import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { Input } from '@/src/components/ui/input';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { resetRoleSelection } from '@/src/lib/reset-role-selection';
import { supabase } from '@/src/lib/supabase';

const INTEREST_OPTIONS = [
  'Food & Drink',
  'Baked Goods',
  'Art & Prints',
  'Jewelry',
  'Apparel',
  'Home & Decor',
  'Plants',
  'Candles & Soap',
  'Vintage & Thrift',
  'Handmade Crafts',
  'Wellness',
  'Pet Goods',
];

export default function InterestsScreen() {
  const { session, user, refreshUser } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.role && user.role !== 'shopper') {
    return <Redirect href="/" />;
  }

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option],
    );
  }

  async function handleContinue() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }
    if (selected.length === 0) {
      setError('Pick at least one interest to personalize your feed.');
      return;
    }

    setLoading(true);
    setError(null);

    const userId = session.user.id;
    const trimmedCity = city.trim();
    const trimmedZip = zip.trim();

    const { error: userError } = await supabase
      .from('users')
      .update({
        city: trimmedCity || null,
        zip_code: trimmedZip || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      setLoading(false);
      setError(userError.message);
      return;
    }

    const { error: shopperError } = await supabase
      .from('shoppers')
      .update({
        interests: selected,
        default_location: trimmedCity || trimmedZip || null,
      })
      .eq('user_id', userId);

    if (shopperError) {
      setLoading(false);
      setError(shopperError.message);
      return;
    }

    await refreshUser();
    setLoading(false);
    router.replace('/');
  }

  async function handleBack() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setBacking(true);
    setError(null);

    const { error: resetError } = await resetRoleSelection(session.user.id, 'shopper');

    setBacking(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    await refreshUser();
    router.replace('/(onboarding)/role-select');
  }

  return (
    <Screen scroll>
      <BackButton onPress={handleBack} loading={backing} disabled={loading} />

      <Text variant="eyebrow" className="mb-2">
        Step 2 of 2
      </Text>
      <Text variant="title" className="mb-2">
        What are you into?
      </Text>
      <Text variant="subtitle" className="mb-6">
        Pick a few interests so we can surface vendors and events you'll love.
      </Text>

      <View className="mb-6 flex-row flex-wrap gap-2">
        {INTEREST_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => toggle(option)}
          />
        ))}
      </View>

      <Text variant="heading" className="mb-3">
        Where do you shop? <Text variant="caption">(optional)</Text>
      </Text>
      <Input label="City" value={city} onChangeText={setCity} placeholder="Austin" />
      <Input
        label="ZIP code"
        value={zip}
        onChangeText={setZip}
        placeholder="78701"
        keyboardType="number-pad"
      />

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <View className="mt-2">
        <Button label="Continue" loading={loading} disabled={backing} onPress={handleContinue} />
      </View>
    </Screen>
  );
}
