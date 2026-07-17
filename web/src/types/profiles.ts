/**
 * Rooted marketplace profile + social graph types (phase51).
 * `profiles.role` is the permanent sticker enum — shopper | vendor only.
 */

/** Permanent sticker / workspace role on `public.profiles`. */
export type ProfileRole = 'shopper' | 'vendor';

/** Vision profiles table — auth user id is the primary key. */
export interface Profile {
  id: string;
  role: ProfileRole | null;
  shopper_interests: string[];
  shopper_zip_code: string | null;
  created_at: string;
  updated_at: string;
}

/** Shopper profile → vendor follow edge. `shopper_id` = `profiles.id`. */
export interface Follow {
  id: string;
  shopper_id: string;
  vendor_id: string;
  created_at: string;
}

export type VendorConnectionStatus = 'pending' | 'connected';

/** Vendor-to-vendor connection request / accepted link. */
export interface VendorConnection {
  id: string;
  sender_vendor_id: string;
  receiver_vendor_id: string;
  status: VendorConnectionStatus;
  created_at: string;
  updated_at: string;
}
