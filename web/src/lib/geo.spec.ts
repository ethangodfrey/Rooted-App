import { describe, expect, it } from 'vitest';

import { coordsFrom, distanceMiles, formatDistance, isValidCoords } from './geo';

describe('isValidCoords', () => {
  it('accepts finite coordinates within Earth bounds', () => {
    expect(isValidCoords({ latitude: 41.8781, longitude: -87.6298 })).toBe(true);
    expect(isValidCoords({ latitude: -90, longitude: 180 })).toBe(true);
    expect(isValidCoords({ latitude: 0, longitude: 0 })).toBe(true);
  });

  it('rejects null, undefined, and out-of-range values', () => {
    expect(isValidCoords(null)).toBe(false);
    expect(isValidCoords(undefined)).toBe(false);
    expect(isValidCoords({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoords({ latitude: 0, longitude: -181 })).toBe(false);
    expect(isValidCoords({ latitude: NaN, longitude: 0 })).toBe(false);
    expect(isValidCoords({ latitude: 0, longitude: Infinity })).toBe(false);
    expect(isValidCoords({ latitude: null, longitude: 0 })).toBe(false);
    expect(isValidCoords({})).toBe(false);
  });
});

describe('coordsFrom', () => {
  it('returns normalized coordinates for valid input', () => {
    expect(coordsFrom({ latitude: 42.5, longitude: -71.2 })).toEqual({
      latitude: 42.5,
      longitude: -71.2,
    });
  });

  it('returns null for invalid or empty input', () => {
    expect(coordsFrom(null)).toBeNull();
    expect(coordsFrom(undefined)).toBeNull();
    expect(coordsFrom({ latitude: 200, longitude: 0 })).toBeNull();
    expect(coordsFrom('')).toBeNull();
  });
});

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

  it('returns Infinity when either coordinate set is invalid', () => {
    const valid = { latitude: 41.8781, longitude: -87.6298 };
    expect(distanceMiles(valid, { latitude: NaN, longitude: 0 })).toBe(Number.POSITIVE_INFINITY);
    expect(distanceMiles(null as never, valid)).toBe(Number.POSITIVE_INFINITY);
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
