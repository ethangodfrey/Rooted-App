import { supabase } from '@/src/lib/supabase';

export interface FollowRow {
  id: string;
  shopper_id: string;
  vendor_id: string;
  created_at: string;
}

export interface FollowedVendor {
  followId: string;
  vendorId: string;
  businessName: string | null;
  logoUrl: string | null;
  category: string | null;
  sellCity: string | null;
  sellState: string | null;
  followedAt: string;
}

/** List vendors the shopper follows. */
export async function fetchFollowedVendors(shopperId: string): Promise<FollowedVendor[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(
      'id, created_at, vendor_id, vendor:vendors(id, business_name, logo_url, category, sell_city, sell_state)',
    )
    .eq('shopper_id', shopperId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data as unknown as Array<{
    id: string;
    created_at: string;
    vendor_id: string;
    vendor: {
      id: string;
      business_name: string | null;
      logo_url: string | null;
      category: string | null;
      sell_city: string | null;
      sell_state: string | null;
    } | null;
  }>) ?? [])
    .filter((row) => row.vendor)
    .map((row) => ({
      followId: row.id,
      vendorId: row.vendor_id,
      businessName: row.vendor!.business_name,
      logoUrl: row.vendor!.logo_url,
      category: row.vendor!.category,
      sellCity: row.vendor!.sell_city,
      sellState: row.vendor!.sell_state,
      followedAt: row.created_at,
    }));
}

export async function isFollowingVendor(
  shopperId: string,
  vendorId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('shopper_id', shopperId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function followVendor(shopperId: string, vendorId: string): Promise<void> {
  const { error } = await supabase.from('follows').upsert(
    { shopper_id: shopperId, vendor_id: vendorId },
    { onConflict: 'shopper_id,vendor_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function unfollowVendor(shopperId: string, vendorId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('shopper_id', shopperId)
    .eq('vendor_id', vendorId);
  if (error) throw new Error(error.message);
}
