import type { OrderStatus, PaymentStatus } from '@/types/database';

/** Orders awaiting day-of pickup at the vendor booth. */
export const PENDING_PICKUP_STATUSES: OrderStatus[] = [
  'pending',
  'submitted',
  'pending_review',
  'accepted',
  'preparing',
  'ready_for_pickup',
];

/** Successfully collected orders shown in the vendor archive. */
export const FULFILLED_ARCHIVE_STATUSES: OrderStatus[] = ['fulfilled', 'completed'];

export function isPendingPickup(status: OrderStatus): boolean {
  return PENDING_PICKUP_STATUSES.includes(status);
}

export function isFulfilledArchive(status: OrderStatus): boolean {
  return FULFILLED_ARCHIVE_STATUSES.includes(status);
}

/** Whether the shopper should see an active pickup pass module. */
export function showPickupPass(status: OrderStatus): boolean {
  return isPendingPickup(status);
}

export function paymentStatusOnFulfill(current: PaymentStatus): PaymentStatus | undefined {
  if (current === 'paid_online') return undefined;
  return 'paid_at_pickup';
}
