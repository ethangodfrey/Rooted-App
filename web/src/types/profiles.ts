/**
 * Rooted marketplace profile + social graph types (phase51).
 * `profiles.role` is the permanent sticker enum — shopper | vendor | farmer.
 */

/** Permanent sticker / workspace role on `public.profiles`. */
export type ProfileRole = 'shopper' | 'vendor' | 'farmer';

/** Vision profiles table — auth user id is the primary key. */
export interface Profile {
  id: string;
  role: ProfileRole | null;
  shopper_interests: string[];
  shopper_zip_code: string | null;
  /** Phase 52 — vendor specialty tokens (uppercase) */
  vendor_specialties: string[];
  /** Phase 52 — farmer specialty tokens (uppercase) */
  farmer_specialties: string[];
  created_at: string;
  updated_at: string;
}

/** Shopper → vendor/farmer follow edge. Both ids reference `profiles.id`. */
export interface Follow {
  id: string;
  shopper_id: string;
  followed_profile_id: string;
  created_at: string;
}

export type NetworkConnectionStatus = 'pending' | 'connected';

/** B2B V2V / F2V connection between vendor and farmer profiles. */
export interface NetworkConnection {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: NetworkConnectionStatus;
  created_at: string;
  updated_at: string;
}

/** @deprecated Prefer NetworkConnection — legacy vendor_connections shape. */
export type VendorConnectionStatus = NetworkConnectionStatus;

/** @deprecated Prefer NetworkConnection. */
export interface VendorConnection {
  id: string;
  sender_vendor_id: string;
  receiver_vendor_id: string;
  status: VendorConnectionStatus;
  created_at: string;
  updated_at: string;
}
