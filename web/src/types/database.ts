export type UserRole = 'shopper' | 'vendor' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EventStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';
export type VisibilityStatus = 'draft' | 'public';
export type ProductStatus = 'active' | 'archived';
export type PostType = 'update' | 'product' | 'event' | 'promo';
export type PostMediaType = 'image' | 'video';
export type OrderStatus =
  | 'submitted'
  | 'pending_review'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'fulfilled'
  | 'cancelled'
  | 'declined';

export interface User {
  id: string;
  role: UserRole | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notification_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Shopper {
  id: string;
  user_id: string;
  interests: string[];
  saved_vendors: string[];
  saved_events: string[];
  default_location: string | null;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string | null;
  business_description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  theme_settings: Record<string, unknown>;
  category: string | null;
  website_url: string | null;
  instagram_url: string | null;
  sell_city: string | null;
  sell_state: string | null;
  product_summary: string | null;
  selling_channels: string[] | null;
  primary_market: string | null;
  application_submitted_at: string | null;
  approval_status: ApprovalStatus;
  messaging_enabled: boolean;
  custom_orders_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  organizer_name: string | null;
  banner_url: string | null;
  start_datetime: string;
  end_datetime: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  event_status: EventStatus;
  visibility_status: VisibilityStatus;
  parking_info: string | null;
  admission_info: string | null;
  market_type: string | null;
  hours_summary: string | null;
  website_url: string | null;
  extra_info: string | null;
  market_history: string | null;
  what_to_look_for: string | null;
  market_highlights: string | null;
  timezone: string | null;
  sync_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  media_urls: string[];
  category: string | null;
  sku: string | null;
  status: ProductStatus;
  inquiry_enabled: boolean;
  reserve_enabled: boolean;
  reserve_limit_total: number | null;
  reserve_limit_per_shopper: number | null;
  prepay_enabled: boolean;
  custom_order_enabled: boolean;
  prep_time: number | null;
  created_at: string;
  updated_at: string;
}

export interface FeedPost {
  id: string;
  vendor_id: string;
  post_type: PostType;
  caption: string;
  media_url: string | null;
  media_type?: PostMediaType | null;
  video_thumbnail_url?: string | null;
  publish_at: string;
  created_at: string;
  vendor: {
    id: string;
    business_name: string | null;
    sell_city?: string | null;
    sell_state?: string | null;
  } | null;
  product: { id: string; name: string } | null;
  event: { id: string; name: string } | null;
}
