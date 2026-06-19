import { supabase } from '@/src/lib/supabase';

export async function deleteOwnAccount(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  return { error: null };
}
