import { supabase } from '@/src/lib/supabase';
import type { UserRole } from '@/src/types/database';

export type ResettableRole = Extract<UserRole, 'customer' | 'shopper' | 'vendor' | 'chef'>;

/** Clears role + extension row so the user can pick a role again. */
export async function resetRoleSelection(
  userId: string,
  role: ResettableRole,
): Promise<{ error: string | null }> {
  await supabase.from('shoppers').delete().eq('user_id', userId);
  await supabase.from('vendors').delete().eq('user_id', userId);
  await supabase.from('chefs').delete().eq('user_id', userId);

  const { error: roleError } = await supabase
    .from('users')
    .update({ role: null, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (roleError) {
    return { error: roleError.message };
  }

  return { error: null };
}
