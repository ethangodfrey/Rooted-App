import { supabase } from '@/lib/supabase';
import type { Shopper, User, Vendor } from '@/types/database';

type UserWithRelations = User & {
  shopper: Shopper | Shopper[] | null;
  vendor: Vendor | Vendor[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchUserProfileSequential(userId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return { user: null, shopper: null, vendor: null };
  }

  let shopper: Shopper | null = null;
  let vendor: Vendor | null = null;

  if (user.role === 'shopper') {
    const { data } = await supabase.from('shoppers').select('*').eq('user_id', userId).maybeSingle();
    shopper = data;
  } else if (user.role === 'vendor') {
    const { data } = await supabase.from('vendors').select('*').eq('user_id', userId).maybeSingle();
    vendor = data;
  }

  return { user, shopper, vendor };
}

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*, shopper:shoppers(*), vendor:vendors(*)')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return fetchUserProfileSequential(userId);
  }

  const row = data as unknown as UserWithRelations;
  const { shopper: shopperRel, vendor: vendorRel, ...user } = row;

  return {
    user: user as User,
    shopper: firstRelation(shopperRel),
    vendor: firstRelation(vendorRel),
  };
}
