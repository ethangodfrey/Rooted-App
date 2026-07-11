import { formatPrice } from '@/lib/format';
import type { ChefBookingStatus, ChefPriceType, ChefServiceType } from '@/types/database';

export const CHEF_SERVICE_TYPE_LABEL: Record<ChefServiceType, string> = {
  private_dining: 'Private dining',
  meal_prep: 'Meal prep',
  event_catering: 'Event catering',
  cooking_class: 'Cooking class',
  personal_chef: 'Personal chef',
  custom: 'Custom',
};

const PRICE_TYPE_SUFFIX: Record<ChefPriceType, string> = {
  per_person: '/person',
  flat_rate: ' flat',
  hourly: '/hour',
  custom_quote: '',
};

export function formatServicePrice(basePrice: number, priceType: ChefPriceType): string {
  if (priceType === 'custom_quote') return 'Custom quote';
  return `${formatPrice(basePrice)}${PRICE_TYPE_SUFFIX[priceType]}`;
}

export const CHEF_BOOKING_STATUS_LABEL: Record<ChefBookingStatus, string> = {
  inquiry: 'Inquiry',
  pending_review: 'Pending review',
  quoted: 'Quoted',
  accepted: 'Accepted',
  declined: 'Declined',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
