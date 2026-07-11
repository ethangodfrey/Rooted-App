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
  pending: 'Pending',
  completed: 'Completed',
  canceled: 'Canceled',
};

export function nextVendorStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'accepted':
      return 'preparing';
    case 'preparing':
      return 'ready_for_pickup';
    case 'ready_for_pickup':
      return 'fulfilled';
    default:
      return null;
  }
}
