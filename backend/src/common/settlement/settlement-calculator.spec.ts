import { calculateVendorSettlement } from './settlement-calculator';
import { computePlatformFeeCents } from './platform-fee';

describe('computePlatformFeeCents', () => {
  it('applies 5% with half-up rounding', () => {
    expect(computePlatformFeeCents(10_000, 500)).toBe(500);
    expect(computePlatformFeeCents(10_01, 500)).toBe(50);
    expect(computePlatformFeeCents(999, 500)).toBe(50);
  });

  it('returns zero for non-positive amounts', () => {
    expect(computePlatformFeeCents(0, 500)).toBe(0);
    expect(computePlatformFeeCents(-100, 500)).toBe(0);
  });
});

describe('calculateVendorSettlement', () => {
  it('aggregates gross, platform fee, and net vendor allocations', () => {
    const result = calculateVendorSettlement([
      { id: 'a', totalCents: 2000, platformFeeCents: 100 },
      { id: 'b', totalCents: 3000, platformFeeCents: 150 },
    ]);

    expect(result.orderCount).toBe(2);
    expect(result.grossVolumeCents).toBe(5000);
    expect(result.platformFeeCents).toBe(250);
    expect(result.netVendorCents).toBe(4750);
    expect(result.lines).toHaveLength(2);
  });

  it('derives platform fee when not persisted on the order', () => {
    const result = calculateVendorSettlement([{ id: 'x', totalCents: 10_000 }]);
    expect(result.platformFeeCents).toBe(500);
    expect(result.netVendorCents).toBe(9500);
  });

  it('stays stable across large settlement arrays', () => {
    const orders = Array.from({ length: 5_000 }, (_, index) => ({
      id: `order-${index}`,
      totalCents: 199 + (index % 3),
    }));

    const result = calculateVendorSettlement(orders);
    const expectedGross = orders.reduce((sum, order) => sum + order.totalCents, 0);
    const expectedFees = orders.reduce(
      (sum, order) => sum + computePlatformFeeCents(order.totalCents, 500),
      0,
    );

    expect(result.grossVolumeCents).toBe(expectedGross);
    expect(result.platformFeeCents).toBe(expectedFees);
    expect(result.netVendorCents).toBe(expectedGross - expectedFees);
  });
});
