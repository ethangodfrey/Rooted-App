import { supabase } from '@/src/lib/supabase';
import { isCustomerRole } from '@/src/lib/role-utils';
import type { Chef, Shopper, User, Vendor } from '@/src/types/database';

async function fetchUserProfileSequential(userId: string): Promise<{
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  chef: Chef | null;
}> {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, role, email, name, city, state, zip_code, profile_photo, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return { user: null, shopper: null, vendor: null, chef: null };
  }

  let shopper: Shopper | null = null;
  let vendor: Vendor | null = null;
  let chef: Chef | null = null;

  if (isCustomerRole(user.role)) {
    const { data } = await supabase.from('shoppers').select('*').eq('user_id', userId).maybeSingle();
    shopper = data;
  } else if (user.role === 'vendor') {
    const { data } = await supabase.from('vendors').select('*').eq('user_id', userId).maybeSingle();
    vendor = data;
  } else if (user.role === 'chef') {
    const { data } = await supabase.from('chefs').select('*').eq('user_id', userId).maybeSingle();
    chef = data;
  }

  return { user: user as User, shopper, vendor, chef };
}

/** Fetches user profile; only loads the role-specific extension row (faster than embedding all three). */
export async function fetchUserProfile(userId: string): Promise<{
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  chef: Chef | null;
}> {
  return fetchUserProfileSequential(userId);
}
