import { supabase } from '@/src/lib/supabase';
import type { ProfileRole } from '@/src/types/profiles';

/** Permanent sticker roles selected during onboarding. */
export type StickerOnboardingRole = ProfileRole;

/** @deprecated Prefer StickerOnboardingRole — chef retained for legacy ops paths. */
export type OnboardingRole = StickerOnboardingRole | 'chef';

/** Ensures the correct extension row exists when onboarding picks a role. */
export async function ensureRoleExtension(
  userId: string,
  role: OnboardingRole,
): Promise<{ error: string | null }> {
  await supabase.from('shoppers').delete().eq('user_id', userId);
  await supabase.from('vendors').delete().eq('user_id', userId);
  await supabase.from('farmers').delete().eq('user_id', userId);
  await supabase.from('chefs').delete().eq('user_id', userId);

  if (role === 'shopper') {
    const { data: existing, error: readError } = await supabase
      .from('shoppers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) return { error: readError.message };
    if (existing) return { error: null };

    const { error } = await supabase.from('shoppers').insert({ user_id: userId });
    return { error: error?.message ?? null };
  }

  if (role === 'vendor') {
    const { data: existing, error: readError } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) return { error: readError.message };
    if (existing) return { error: null };

    const { error } = await supabase.from('vendors').insert({
      user_id: userId,
      approval_status: 'pending',
    });
    return { error: error?.message ?? null };
  }

  if (role === 'farmer') {
    const { data: existing, error: readError } = await supabase
      .from('farmers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) return { error: readError.message };
    if (existing) return { error: null };

    const { error } = await supabase.from('farmers').insert({
      user_id: userId,
      approval_status: 'pending',
    });
    return { error: error?.message ?? null };
  }

  const { data: existingChef, error: chefReadError } = await supabase
    .from('chefs')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (chefReadError) return { error: chefReadError.message };
  if (existingChef) return { error: null };

  const { data: userRow } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .maybeSingle();

  const displayName = userRow?.name?.trim() || userRow?.email?.split('@')[0] || 'Chef';

  const { error } = await supabase.from('chefs').insert({
    user_id: userId,
    display_name: displayName,
    approval_status: 'pending',
  });

  return { error: error?.message ?? null };
}
