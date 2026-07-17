import { supabase } from '@/src/lib/supabase';
import type { Follow } from '@/src/types/profiles';

/** @deprecated Prefer `Follow` from `@/src/types/profiles`. */
export type FollowRow = Follow;

export interface FollowedProfile {
  followId: string;
  profileId: string;
  /** Alias for storefront deep links that still key off vendors.id */
  vendorId: string | null;
  role: 'vendor' | 'farmer' | null;
  displayName: string | null;
  /** @deprecated Prefer displayName */
  businessName: string | null;
  logoUrl: string | null;
  category: string | null;
  sellCity: string | null;
  sellState: string | null;
  followedAt: string;
}

/** @deprecated Prefer FollowedProfile */
export type FollowedVendor = FollowedProfile;

/**
 * List vendor/farmer profiles the shopper follows.
 * @param shopperProfileId `profiles.id` (auth user id)
 */
export async function fetchFollowedVendors(
  shopperProfileId: string,
): Promise<FollowedProfile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('id, created_at, followed_profile_id')
    .eq('shopper_id', shopperProfileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const enriched: FollowedProfile[] = [];
  for (const row of data ?? []) {
    const profileId = row.followed_profile_id as string;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', profileId)
      .maybeSingle();

    const role = profile?.role === 'farmer' || profile?.role === 'vendor' ? profile.role : null;
    let vendorId: string | null = null;
    let displayName: string | null = null;
    let logoUrl: string | null = null;
    let category: string | null = null;
    let sellCity: string | null = null;
    let sellState: string | null = null;

    if (role === 'vendor') {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, business_name, logo_url, category, sell_city, sell_state')
        .eq('user_id', profileId)
        .maybeSingle();
      vendorId = vendor?.id ?? null;
      displayName = vendor?.business_name ?? null;
      logoUrl = vendor?.logo_url ?? null;
      category = vendor?.category ?? null;
      sellCity = vendor?.sell_city ?? null;
      sellState = vendor?.sell_state ?? null;
    } else if (role === 'farmer') {
      const { data: farmer } = await supabase
        .from('farmers')
        .select('farm_name, logo_url, sell_city, sell_state')
        .eq('user_id', profileId)
        .maybeSingle();
      displayName = farmer?.farm_name ?? null;
      logoUrl = farmer?.logo_url ?? null;
      sellCity = farmer?.sell_city ?? null;
      sellState = farmer?.sell_state ?? null;
    }

    enriched.push({
      followId: row.id,
      profileId,
      vendorId,
      role,
      displayName,
      businessName: displayName,
      logoUrl,
      category,
      sellCity,
      sellState,
      followedAt: row.created_at,
    });
  }

  return enriched;
}

export async function isFollowingProfile(
  shopperProfileId: string,
  followedProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('shopper_id', shopperProfileId)
    .eq('followed_profile_id', followedProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** @deprecated Prefer isFollowingProfile — second arg is profile id, not vendors.id */
export const isFollowingVendor = isFollowingProfile;

export async function followProfile(
  shopperProfileId: string,
  followedProfileId: string,
): Promise<void> {
  const { error } = await supabase.from('follows').upsert(
    { shopper_id: shopperProfileId, followed_profile_id: followedProfileId },
    { onConflict: 'shopper_id,followed_profile_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

/** @deprecated Prefer followProfile */
export const followVendor = followProfile;

export async function unfollowProfile(
  shopperProfileId: string,
  followedProfileId: string,
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('shopper_id', shopperProfileId)
    .eq('followed_profile_id', followedProfileId);
  if (error) throw new Error(error.message);
}

/** @deprecated Prefer unfollowProfile */
export const unfollowVendor = unfollowProfile;
