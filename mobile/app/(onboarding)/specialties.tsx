import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SpecialtyPills } from '@/src/components/ui/SpecialtyPills';
import { UserSticker } from '@/src/components/ui/UserSticker';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import {
  normalizeSpecialtySelection,
  specialtiesForRole,
  type SpecialtyTag,
} from '@/src/lib/specialties';
import { supabase } from '@/src/lib/supabase';

export default function SpecialtiesScreen() {
  const { session, user, refreshUser, signOut } = useAuth();
  const role = user?.role === 'farmer' || user?.role === 'vendor' ? user.role : null;
  const [selected, setSelected] = useState<SpecialtyTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !role) return;
    const raw = role === 'farmer' ? user.farmer_specialties : user.vendor_specialties;
    setSelected(normalizeSpecialtySelection(role, raw ?? []));
  }, [user, role]);

  if (!session?.user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user && !role) {
    return <Redirect href="/" />;
  }

  if (!role) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0B1228' }}>
        <Text className="text-slate-400">Loading…</Text>
      </View>
    );
  }

  const options = specialtiesForRole(role);

  function toggle(tag: SpecialtyTag) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleContinue() {
    if (selected.length === 0) {
      setError('Pick at least one specialty.');
      return;
    }
    setLoading(true);
    setError(null);
    const userId = session!.user.id;
    const payload =
      role === 'farmer'
        ? { farmer_specialties: selected, vendor_specialties: [] as string[] }
        : { vendor_specialties: selected, farmer_specialties: [] as string[] };

    const { error: profileError } = await supabase.from('profiles').upsert(
      { id: userId, role, ...payload, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );

    if (profileError) {
      const { error: userError } = await supabase
        .from('users')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (userError) {
        setLoading(false);
        setError(profileError.message || userError.message);
        return;
      }
    }

    await refreshUser();
    setLoading(false);
    router.replace('/');
  }

  return (
    <ScrollView className="flex-1 px-5 pt-14" style={{ backgroundColor: '#0B1228' }}>
      <Pressable onPress={signOut} className="mb-8 self-start active:opacity-70">
        <Text className="text-sm font-medium text-slate-400">Sign out</Text>
      </Pressable>

      <View className="mb-4 flex-row flex-wrap items-center gap-2">
        <UserSticker role={role} />
        <SpecialtyPills specialties={selected} />
      </View>

      <Text className="text-3xl font-semibold tracking-tight text-white">Your specialties</Text>
      <Text className="mt-3 text-sm leading-5 text-slate-400">
        Select categories that describe what you offer. Shown as text tags on your profile.
      </Text>

      <View className="mt-8 gap-2 pb-10">
        {options.map((tag) => {
          const active = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              className="flex-row items-center justify-between rounded-xl border px-4 py-3"
              style={{
                borderColor: active ? 'rgba(129,140,248,0.85)' : 'rgba(71,85,105,0.7)',
                backgroundColor: active ? 'rgba(99,102,241,0.28)' : 'rgba(15,23,42,0.55)',
              }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-[1.5px]"
                style={{ color: active ? '#e0e7ff' : '#94a3b8' }}
              >
                {tag}
              </Text>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  borderWidth: active ? 0 : 1,
                  borderColor: 'rgba(148,163,184,0.5)',
                  backgroundColor: active ? '#818cf8' : 'transparent',
                }}
              />
            </Pressable>
          );
        })}

        {error ? <Text className="mt-4 text-sm font-medium text-red-300">{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={() => void handleContinue()}
          className="mt-6 items-center rounded-xl border border-orange-500/40 py-3"
          style={{ backgroundColor: 'rgba(249,115,22,0.15)', opacity: loading ? 0.6 : 1 }}
        >
          <Text className="text-sm font-semibold uppercase tracking-[1.5px] text-orange-200">
            {loading ? 'Saving…' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
