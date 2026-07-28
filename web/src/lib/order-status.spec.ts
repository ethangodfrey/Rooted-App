import { describe, expect, it } from 'vitest';

import { ORDER_STATUS_LABEL, nextVendorStatus } from './order-status';

describe('ORDER_STATUS_LABEL', () => {
  it('provides a human-readable label for every known status', () => {
    expect(ORDER_STATUS_LABEL.submitted).toBe('Submitted');
    expect(ORDER_STATUS_LABEL.ready_for_pickup).toBe('Ready for pickup');
    expect(ORDER_STATUS_LABEL.fulfilled).toBe('Fulfilled');
    expect(ORDER_STATUS_LABEL.canceled).toBe('Canceled');
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

  it('returns null for terminal or non-vendor-actionable statuses', () => {
    expect(nextVendorStatus('submitted')).toBeNull();
    expect(nextVendorStatus('pending_review')).toBeNull();
    expect(nextVendorStatus('declined')).toBeNull();
    expect(nextVendorStatus('fulfilled')).toBeNull();
    expect(nextVendorStatus('cancelled')).toBeNull();
    expect(nextVendorStatus('completed')).toBeNull();
    expect(nextVendorStatus('canceled')).toBeNull();
    expect(nextVendorStatus('pending')).toBeNull();
  });
});
