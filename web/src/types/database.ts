export type UserRole = 'customer' | 'shopper' | 'vendor' | 'chef' | 'admin';

export type VendorType =
  | 'farmers_market'
  | 'home_kitchen'
  | 'food_business'
  | 'caterer'
  | 'meal_prep';

export type ProductAvailabilityType = 'always' | 'event_only' | 'preorder_only' | 'seasonal';

export type OrderType = 'event_pickup' | 'direct_pickup' | 'delivery';

export type ChefServiceType =
  | 'private_dining'
  | 'meal_prep'
  | 'event_catering'
  | 'cooking_class'
  | 'personal_chef'
  | 'custom';

export type ChefPriceType = 'per_person' | 'flat_rate' | 'hourly' | 'custom_quote';

export type ChefBookingStatus =
  | 'inquiry'
  | 'pending_review'
  | 'quoted'
  | 'accepted'
  | 'declined'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ChefPaymentStatus = 'unpaid' | 'deposit_paid' | 'paid_in_full';

export type SavedItemType = 'vendor' | 'chef' | 'product' | 'service' | 'event';

export type ExploreContentType =
  | 'portfolio'
  | 'behind_scenes'
  | 'recipe'
  | 'promotion'
  | 'announcement'
  | 'menu_highlight';

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
  street_address: string | null;
  postal_code: string | null;
  country: string | null;
  product_summary: string | null;
  selling_channels: string[] | null;
  primary_market: string | null;
  application_submitted_at: string | null;
  approval_status: ApprovalStatus;
  messaging_enabled: boolean;
  custom_orders_enabled: boolean;
  vendor_type: VendorType | null;
  serves_delivery: boolean;
  delivery_radius_miles: number | null;
  accepts_custom_orders: boolean;
  cuisine_tags: string[];
  dietary_tags: string[];
  minimum_order_amount: number | null;
  lead_time_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface Chef {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  profile_photo_url: string | null;
  banner_url: string | null;
  cuisine_specialties: string[];
  service_types: string[];
  hourly_rate: number | null;
  base_event_rate: number | null;
  serves_radius_miles: number | null;
  home_base_city: string | null;
  home_base_state: string | null;
  street_address: string | null;
  postal_code: string | null;
  country: string | null;
  availability_settings: Record<string, unknown>;
  instagram_url: string | null;
  website_url: string | null;
  approval_status: ApprovalStatus;
  featured: boolean;
  rating_average: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChefService {
  id: string;
  chef_id: string;
  service_name: string;
  service_type: ChefServiceType;
  description: string | null;
  base_price: number;
  price_type: ChefPriceType;
  min_guests: number | null;
  max_guests: number | null;
  duration_hours: number | null;
  includes_groceries: boolean;
  media_urls: string[];
  active: boolean;
  created_at: string;
}

export interface ChefBooking {
  id: string;
  customer_id: string;
  chef_id: string;
  service_id: string;
  booking_status: ChefBookingStatus;
  event_date: string;
  event_time: string | null;
  duration_hours: number | null;
  guest_count: number | null;
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
  dietary_requirements: string[];
  special_requests: string | null;
  quoted_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  final_amount: number | null;
  payment_status: ChefPaymentStatus;
  customer_notes: string | null;
  chef_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChefReview {
  id: string;
  chef_id: string;
  customer_id: string;
  booking_id: string | null;
  rating: number;
  review_text: string | null;
  response_text: string | null;
  verified_booking: boolean;
  created_at: string;
}

export interface ChefPortfolioItem {
  id: string;
  chef_id: string;
  title: string | null;
  description: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  event_type: string | null;
  display_order: number;
  created_at: string;
}

export interface ExploreContent {
  id: string;
  creator_type: 'vendor' | 'chef';
  vendor_id: string | null;
  chef_id: string | null;
  content_type: ExploreContentType;
  title: string | null;
  caption: string | null;
  media_urls: string[];
  linked_product_id: string | null;
  linked_service_id: string | null;
  tags: string[];
  engagement_count: number;
  created_at: string;
}

export interface SavedItem {
  id: string;
  customer_id: string;
  item_type: SavedItemType;
  vendor_id: string | null;
  chef_id: string | null;
  product_id: string | null;
  service_id: string | null;
  event_id: string | null;
  created_at: string;
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
  available_for_delivery: boolean;
  available_for_pickup: boolean;
  made_to_order: boolean;
  lead_time_hours: number | null;
  dietary_tags: string[];
  ingredients: string | null;
  allergen_info: string | null;
  serving_size: string | null;
  availability_type: ProductAvailabilityType;
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

export type CredentialType =
  | 'identity_verified'
  | 'food_safety_certified'
  | 'cottage_food_permit'
  | 'commercial_kitchen'
  | 'health_department_permit'
  | 'liability_insurance'
  | 'business_license';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface VerificationCredential {
  id: string;
  user_id: string;
  credential_type: CredentialType;
  issuing_authority: string | null;
  credential_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrustBadge {
  id: string;
  badge_type: string;
  badge_name: string;
  badge_icon: string | null;
  badge_description: string | null;
}

export interface StateFoodRegulation {
  state_code: string;
  state_name: string;
  cottage_food_allowed: boolean;
  annual_revenue_limit: number | null;
  requires_food_handler_cert: boolean;
  requires_permit: boolean;
  allows_online_sales: boolean;
  allowed_product_categories: string[];
  prohibited_products: string[];
  required_disclaimer: string | null;
  regulation_url: string | null;
}

export type ComplianceStatus = 'compliant' | 'pending_review' | 'needs_attention' | 'suspended';

export interface VendorCompliance {
  id: string;
  vendor_id: string;
  state_code: string | null;
  ytd_revenue: number;
  compliance_status: ComplianceStatus;
  has_required_permits: boolean;
  has_food_handler_cert: boolean;
  labeling_compliant: boolean;
  notes: string | null;
}

export type ReviewTargetType = 'vendor' | 'chef' | 'product' | 'service';

export interface Review {
  id: string;
  reviewer_id: string | null;
  target_type: ReviewTargetType;
  vendor_id: string | null;
  chef_id: string | null;
  product_id: string | null;
  service_id: string | null;
  overall_rating: number;
  review_title: string | null;
  review_text: string | null;
  verified_purchase: boolean;
  moderation_status: 'pending' | 'approved' | 'flagged' | 'removed';
  response_text: string | null;
  response_at: string | null;
  created_at: string;
}

export interface RatingAggregate {
  target_type: string;
  target_id: string;
  total_reviews: number;
  average_rating: number | null;
}
