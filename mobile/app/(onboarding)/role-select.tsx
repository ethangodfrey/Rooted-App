import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { UserSticker } from '@/src/components/ui/UserSticker';
import { Text } from '@/src/components/ui/text';
import { LAUNCH_FEATURES, logLaunchPruneMarkers } from '@/src/config/features';
import { useAuth } from '@/src/hooks/use-auth';
import { isAdminDevEmail } from '@/src/lib/admin-dev';
import {
  ensureRoleExtension,
  type OnboardingRole,
  type StickerOnboardingRole,
} from '@/src/lib/role-selection';
import { supabase } from '@/src/lib/supabase';

type SelectableRole = StickerOnboardingRole | 'chef';

const BASE_ROLE_CARDS: {
  role: SelectableRole;
  title: string;
  meta: string;
  accent: 'shopper' | 'vendor' | 'farmer' | 'chef';
}[] = [
  {
    role: 'shopper',
    title: 'Shopper',
    meta: 'Explore local listings, follow vendors and farmers, and check out.',
    accent: 'shopper',
  },
  {
    role: 'vendor',
    title: 'Vendor',
    meta: 'List prepared products, post updates, run pre-orders, and connect B2B.',
    accent: 'vendor',
  },
  {
    role: 'farmer',
    title: 'Farmer',
    meta: 'List raw or bulk harvest goods, share daily updates, and supply vendors.',
    accent: 'farmer',
  },
  {
    role: 'chef',
    title: 'Private Chef',
    meta: 'Offer private dining and wholesale catering demand to local hosts.',
    accent: 'chef',
  },
];

export default function RoleSelectScreen() {
  const { session, user, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState<SelectableRole | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleCards = useMemo(
    () =>
      BASE_ROLE_CARDS.filter((card) => {
        if ((card.role as string) === 'creator') return false;
        if (card.role === 'chef') return LAUNCH_FEATURES.ENABLE_CHEF_ROLE;
        return true;
      }),
    [],
  );

  const showAdminLogin = useMemo(
    () => isAdminDevEmail(session?.user?.email ?? user?.email),
    [session?.user?.email, user?.email],
  );

  useEffect(() => {
    logLaunchPruneMarkers();
  }, []);

  if (user?.role && loading === null) {
    return <Redirect href="/" />;
  }

  async function selectRole(role: SelectableRole) {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setLoading(role);
    setError(null);

    const userId = session.user.id;

    if (role === 'chef') {
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'chef', updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (roleError) {
        setLoading(null);
        setError(roleError.message);
        return;
      }
    } else {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        const { error: roleError } = await supabase
          .from('users')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (roleError) {
          setLoading(null);
          setError(profileError.message || roleError.message);
          return;
        }
      }
    }

    const { error: extensionError } = await ensureRoleExtension(userId, role as OnboardingRole);

    if (extensionError) {
      setLoading(null);
      setError(extensionError);
      return;
    }

    await refreshUser();
    if (role === 'vendor' || role === 'farmer') {
      router.replace('/(onboarding)/specialties');
    } else if (role === 'chef') {
      router.replace('/(chef)/profile/setup');
    } else {
      router.replace('/');
    }
    setLoading(null);
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

  return (
    <View className="flex-1 px-5 pt-14" style={{ backgroundColor: '#0B1228' }}>
      <Pressable onPress={signOut} className="mb-8 self-start active:opacity-70">
        <Text className="text-sm font-medium text-slate-400">Sign out</Text>
      </Pressable>

      <Text className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-orange-400">
        Rooted
      </Text>
      <Text className="text-3xl font-semibold tracking-tight text-white">Who are you here as?</Text>
      <Text className="mt-3 text-sm leading-5 text-slate-400">
        Choose your permanent role badge. This sticker appears on your profile, storefront, and
        chats.
      </Text>

      <View className="mt-8 gap-4">
        {roleCards.map((card) => {
          const active = loading === card.role;
          const tone =
            card.accent === 'shopper'
              ? { bg: 'rgba(99,102,241,0.16)', border: 'rgba(129,140,248,0.35)', label: '#a5b4fc' }
              : card.accent === 'vendor'
                ? { bg: 'rgba(249,115,22,0.16)', border: 'rgba(251,146,60,0.4)', label: '#fdba74' }
                : card.accent === 'chef'
                  ? { bg: 'rgba(244,114,182,0.16)', border: 'rgba(244,114,182,0.4)', label: '#f9a8d4' }
                  : { bg: 'rgba(34,197,94,0.16)', border: 'rgba(74,222,128,0.4)', label: '#86efac' };
          return (
            <Pressable
              key={card.role}
              disabled={loading !== null}
              onPress={() => void selectRole(card.role)}
              className="min-h-[180px] rounded-2xl border p-5 active:opacity-90"
              style={{
                backgroundColor: tone.bg,
                borderColor: tone.border,
                opacity: loading !== null && !active ? 0.55 : 1,
              }}
            >
              {card.role === 'chef' ? (
                <Text
                  className="text-[10px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: tone.label }}
                >
                  PRIVATE CHEF
                </Text>
              ) : (
                <UserSticker role={card.role} />
              )}
              <Text className="mt-4 text-xl font-semibold text-white">{card.title}</Text>
              <Text className="mt-2 flex-1 text-sm leading-5 text-slate-300">{card.meta}</Text>
              <Text
                className="mt-5 text-xs font-semibold uppercase tracking-[1.5px]"
                style={{ color: tone.label }}
              >
                {active ? 'Saving…' : 'Select'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showAdminLogin ? (
        <Pressable
          onPress={() => void handleAdminLogin()}
          disabled={adminLoading || loading !== null}
          className="mt-6 items-center py-3 active:opacity-70"
        >
          {adminLoading ? (
            <ActivityIndicator color="#fb923c" />
          ) : (
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Admin access
            </Text>
          )}
        </Pressable>
      ) : null}

      {error ? <Text className="mt-4 text-sm font-medium text-red-300">{error}</Text> : null}
    </View>
  );
}
