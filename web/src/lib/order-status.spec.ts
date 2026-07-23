import { describe, expect, it } from 'vitest';

import { nextVendorStatus, ORDER_STATUS_LABEL } from './order-status';
import type { OrderStatus } from '@/types/database';

describe('ORDER_STATUS_LABEL', () => {
  it('provides a human-readable label for every order status', () => {
    const statuses: OrderStatus[] = [
      'submitted',
      'pending_review',
      'accepted',
      'declined',
      'preparing',
      'ready_for_pickup',
      'fulfilled',
      'cancelled',
      'pending',
      'completed',
      'canceled',
    ];

    for (const status of statuses) {
      expect(ORDER_STATUS_LABEL[status]).toBeTruthy();
      expect(typeof ORDER_STATUS_LABEL[status]).toBe('string');
    }
  });
});

describe('nextVendorStatus', () => {
  it('advances accepted orders to preparing', () => {
    expect(nextVendorStatus('accepted')).toBe('preparing');
  });

  it('advances preparing orders to ready_for_pickup', () => {
    expect(nextVendorStatus('preparing')).toBe('ready_for_pickup');
  });

  it('advances ready_for_pickup orders to fulfilled', () => {
    expect(nextVendorStatus('ready_for_pickup')).toBe('fulfilled');
  });

  it('returns null for terminal or non-actionable statuses', () => {
    const terminal: OrderStatus[] = [
      'submitted',
      'pending_review',
      'declined',
      'fulfilled',
      'cancelled',
      'pending',
      'completed',
      'canceled',
    ];

    for (const status of terminal) {
      expect(nextVendorStatus(status)).toBeNull();
    }
  });
});
