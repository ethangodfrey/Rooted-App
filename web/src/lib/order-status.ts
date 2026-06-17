import type { OrderStatus } from '@/types/database';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: 'Submitted',
  pending_review: 'Pending review',
  accepted: 'Accepted',
  declined: 'Declined',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};
