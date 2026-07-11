import { describe, expect, it } from 'vitest';

import { distanceMiles, formatDistance } from './geo';

describe('distanceMiles', () => {
  it('returns zero for identical coordinates', () => {
    const point = { latitude: 41.8781, longitude: -87.6298 };
    expect(distanceMiles(point, point)).toBe(0);
  });

  it('computes a positive distance between two cities', () => {
    const chicago = { latitude: 41.8781, longitude: -87.6298 };
    const milwaukee = { latitude: 43.0389, longitude: -87.9065 };
    const miles = distanceMiles(chicago, milwaukee);
    expect(miles).toBeGreaterThan(70);
    expect(miles).toBeLessThan(95);
  });
});

describe('formatDistance', () => {
  it('shows one decimal place under 10 miles', () => {
    expect(formatDistance(0)).toBe('0.0 mi');
    expect(formatDistance(0.4)).toBe('0.4 mi');
    expect(formatDistance(9.9)).toBe('9.9 mi');
  });

  it('rounds to whole miles at 10 or above', () => {
    expect(formatDistance(10)).toBe('10 mi');
    expect(formatDistance(12.4)).toBe('12 mi');
    expect(formatDistance(99.6)).toBe('100 mi');
  });
});
