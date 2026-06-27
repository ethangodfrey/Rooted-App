import { Redirect, router } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { APP_NAME, APP_TAGLINE } from '@/constants/Config';
import { BackButton } from '@/src/components/ui/back-button';
import { PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { isAdminDevEmail } from '@/src/lib/admin-dev';
import { ensureRoleExtension, type OnboardingRole } from '@/src/lib/role-selection';
import { supabase } from '@/src/lib/supabase';

export default function RoleSelectScreen() {
  const { session, user, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState<OnboardingRole | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAdminLogin = useMemo(
    () => isAdminDevEmail(session?.user?.email ?? user?.email),
    [session?.user?.email, user?.email],
  );

  if (user?.role) {
    return <Redirect href="/" />;
  }

  async function selectRole(role: OnboardingRole) {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setLoading(role);
    setError(null);

    const userId = session.user.id;

    const { error: roleError } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (roleError) {
      setLoading(null);
      setError(roleError.message);
      return;
    }

    const { error: extensionError } = await ensureRoleExtension(userId, role);

    if (extensionError) {
      setLoading(null);
      setError(extensionError);
      return;
    }

    await refreshUser();
    setLoading(null);
    router.replace('/');
  }

  async function handleAdminLogin() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setAdminLoading(true);
    setError(null);

    const userId = session.user.id;

    await supabase.from('shoppers').delete().eq('user_id', userId);
    await supabase.from('vendors').delete().eq('user_id', userId);
    await supabase.from('chefs').delete().eq('user_id', userId);

    const { error: roleError } = await supabase
      .from('users')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', userId);

    setAdminLoading(false);

    if (roleError) {
      setError(roleError.message);
      return;
    }

    await refreshUser();
    router.replace('/(admin)/(tabs)/vendors');
  }

  async function handleBack() {
    setBacking(true);
    setError(null);
    await signOut();
  }

  return (
    <Screen scroll>
      <BackButton
        onPress={handleBack}
        loading={backing}
        disabled={loading !== null || adminLoading}
      />

      <Text variant="eyebrow" className="mb-2">
        {APP_NAME}
      </Text>
      <Text variant="title" className="mb-2">
        How will you use Vendorly?
      </Text>
      <Text variant="subtitle" className="mb-6">
        {APP_TAGLINE}
      </Text>

      <PressableCard
        className="mb-4 min-h-[100px] justify-center"
        onPress={() => selectRole('customer')}
        disabled={loading !== null || backing}>
        {loading === 'customer' ? (
          <LoadingIndicator />
        ) : (
          <>
            <Text variant="heading" className="mb-1.5">
              Customer
            </Text>
            <Text variant="caption">
              Discover markets, book private chefs, and order from local food businesses.
            </Text>
          </>
        )}
      </PressableCard>

      <PressableCard
        className="mb-4 min-h-[100px] justify-center"
        onPress={() => selectRole('vendor')}
        disabled={loading !== null || backing}>
        {loading === 'vendor' ? (
          <LoadingIndicator />
        ) : (
          <>
            <Text variant="heading" className="mb-1.5">
              Vendor
            </Text>
            <Text variant="caption">
              Sell at farmers markets or direct-to-customer from your home kitchen or food business.
            </Text>
          </>
        )}
      </PressableCard>

      <PressableCard
        className="mb-4 min-h-[100px] justify-center"
        onPress={() => selectRole('chef')}
        disabled={loading !== null || backing}>
        {loading === 'chef' ? (
          <LoadingIndicator />
        ) : (
          <>
            <Text variant="heading" className="mb-1.5">
              Chef
            </Text>
            <Text variant="caption">
              Offer private dining, meal prep, catering, and other bookable culinary services.
            </Text>
          </>
        )}
      </PressableCard>

      {error ? (
        <View>
          <Text className="mt-2 text-sm text-danger">{error}</Text>
        </View>
      ) : null}

      {showAdminLogin ? (
        <Pressable
          accessibilityRole="button"
          className="mt-8 items-center py-1"
          disabled={loading !== null || adminLoading || backing}
          onPress={handleAdminLogin}>
          {adminLoading ? (
            <LoadingIndicator size="small" />
          ) : (
            <Text className="text-xs text-forest-600">Admin login</Text>
          )}
        </Pressable>
      ) : null}
    </Screen>
  );
}
