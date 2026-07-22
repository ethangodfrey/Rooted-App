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

export type NetworkConnectionStatus = 'none' | 'pending' | 'connected' | 'ignored';

/** Phase 83b V2V connection between vendors (`vendor_connections`). */
export interface NetworkConnection {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: NetworkConnectionStatus;
  is_following?: boolean;
  receiver_is_following?: boolean;
  created_at: string;
  updated_at?: string;
}

/** Alias matching the SQL table name. */
export type VendorConnectionRow = NetworkConnection;
export type VendorConnectionStatus = NetworkConnectionStatus;
