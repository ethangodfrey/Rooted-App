import type { OrderStatus } from '@/src/types/database';

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

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  submitted: 'bg-honeydew text-primary',
  pending_review: 'bg-honeydew text-primary',
  accepted: 'bg-honeydew text-primary',
  declined: 'bg-honeydew text-danger',
  preparing: 'bg-honeydew text-warn',
  ready_for_pickup: 'bg-honeydew text-warn',
  fulfilled: 'bg-honeydew text-primary',
  cancelled: 'bg-honeydew text-muted',
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

export function canCancel(status: OrderStatus): boolean {
  return status === 'submitted' || status === 'pending_review' || status === 'accepted';
}
