import { describe, expect, it } from 'vitest';

import { coordsFrom, distanceMiles, formatDistance, isValidCoords, parseCoords } from './geo';

describe('isValidCoords', () => {
  it('accepts valid Earth-bound coordinates', () => {
    expect(isValidCoords({ latitude: 41.8781, longitude: -87.6298 })).toBe(true);
    expect(isValidCoords({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isValidCoords({ latitude: -90, longitude: 180 })).toBe(true);
  });

  it('rejects null, undefined, and empty objects', () => {
    expect(isValidCoords(null)).toBe(false);
    expect(isValidCoords(undefined)).toBe(false);
    expect(isValidCoords({})).toBe(false);
  });

  it('rejects out-of-range or non-finite values', () => {
    expect(isValidCoords({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoords({ latitude: 0, longitude: -181 })).toBe(false);
    expect(isValidCoords({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidCoords({ latitude: 0, longitude: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('coerces numeric strings from database payloads', () => {
    expect(isValidCoords({ latitude: '41.8781', longitude: '-87.6298' })).toBe(true);
    expect(coordsFrom({ latitude: '40.7', longitude: '-74.0' })).toEqual({
      latitude: 40.7,
      longitude: -74.0,
    });
    expect(isValidCoords({ latitude: 'not-a-number', longitude: '0' })).toBe(false);
  });
});

describe('parseCoords', () => {
  it('returns validated coordinates from discrete lat/lng values', () => {
    expect(parseCoords(40.7, -74.0)).toEqual({ latitude: 40.7, longitude: -74.0 });
  });

  it('returns null for undefined, null, or invalid values', () => {
    expect(parseCoords(undefined, undefined)).toBeNull();
    expect(parseCoords(null, null)).toBeNull();
    expect(parseCoords(91, 0)).toBeNull();
    expect(parseCoords(0, Number.NaN)).toBeNull();
  });
});

describe('coordsFrom', () => {
  it('returns normalized coords for valid input', () => {
    expect(coordsFrom({ latitude: 40.7, longitude: -74.0 })).toEqual({
      latitude: 40.7,
      longitude: -74.0,
    });
  });

  it('returns null for invalid input', () => {
    expect(coordsFrom(null)).toBeNull();
    expect(coordsFrom({ latitude: 100, longitude: 0 })).toBeNull();
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

  it('returns Infinity when either endpoint is invalid', () => {
    const valid = { latitude: 41.8781, longitude: -87.6298 };
    expect(distanceMiles(valid, { latitude: 999, longitude: 0 })).toBe(Number.POSITIVE_INFINITY);
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

  it('handles negative distances as formatted values', () => {
    expect(formatDistance(-1.2)).toBe('-1.2 mi');
  });
});
