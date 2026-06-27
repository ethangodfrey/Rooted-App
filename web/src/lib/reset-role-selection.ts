import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/database';

export async function resetRoleSelection(
  userId: string,
  role: Extract<UserRole, 'shopper' | 'vendor' | 'chef'>,
): Promise<{ error: string | null }> {
  const extensionTable =
    role === 'shopper' ? 'shoppers' : role === 'chef' ? 'chefs' : 'vendors';

  const { error: deleteError } = await supabase
    .from(extensionTable)
    .delete()
    .eq('user_id', userId);

  if (deleteError) return { error: deleteError.message };

  const { error: roleError } = await supabase
    .from('users')
    .update({ role: null, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (roleError) return { error: roleError.message };
  return { error: null };
}
