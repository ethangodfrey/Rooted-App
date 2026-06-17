import { supabase } from '@/src/lib/supabase';
import type { UserRole } from '@/src/types/database';

/** Clears role + extension row so the user can pick shopper or vendor again. */
export async function resetRoleSelection(
  userId: string,
  role: Extract<UserRole, 'shopper' | 'vendor'>,
): Promise<{ error: string | null }> {
  const extensionTable = role === 'shopper' ? 'shoppers' : 'vendors';

  const { error: deleteError } = await supabase
    .from(extensionTable)
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: roleError } = await supabase
    .from('users')
    .update({ role: null, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (roleError) {
    return { error: roleError.message };
  }

  return { error: null };
}
