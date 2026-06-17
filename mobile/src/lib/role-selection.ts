import { supabase } from '@/src/lib/supabase';

/** Ensures the correct extension row exists when onboarding picks a role. */
export async function ensureRoleExtension(
  userId: string,
  role: 'shopper' | 'vendor',
): Promise<{ error: string | null }> {
  const table = role === 'shopper' ? 'shoppers' : 'vendors';
  const otherTable = role === 'shopper' ? 'vendors' : 'shoppers';

  // Best-effort: drop the opposite role row so users can switch during signup.
  await supabase.from(otherTable).delete().eq('user_id', userId);

  const { data: existing, error: readError } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    return { error: readError.message };
  }

  if (existing) {
    return { error: null };
  }

  if (role === 'shopper') {
    const { error } = await supabase.from('shoppers').insert({ user_id: userId });
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from('vendors').insert({
    user_id: userId,
    approval_status: 'pending',
  });

  return { error: error?.message ?? null };
}
