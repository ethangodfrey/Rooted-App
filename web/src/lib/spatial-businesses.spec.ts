import { describe, expect, it } from 'vitest';

import {
  boundsFromRegion,
  clusterTrackedBusinesses,
  isValidMapBounds,
  type TrackedBusiness,
} from './spatial-businesses';

function business(
  id: string,
  latitude: number,
  longitude: number,
): TrackedBusiness {
  return {
    profile_id: id,
    role: 'vendor',
    display_name: `Business ${id}`,
    vendor_specialties: [],
    farmer_specialties: [],
    shopper_zip_code: null,
    latitude,
    longitude,
    business_row_id: id,
    entity_kind: 'vendor',
    sell_city: 'Chicago',
    sell_state: 'IL',
  };
}

describe('isValidMapBounds', () => {
  it('accepts well-formed axis-aligned bounds', () => {
    expect(
      isValidMapBounds({
        minLat: 41.0,
        maxLat: 42.0,
        minLng: -88.0,
        maxLng: -87.0,
      }),
    ).toBe(true);
  });

  it('rejects null, undefined, inverted, or out-of-range bounds', () => {
    expect(isValidMapBounds(null)).toBe(false);
    expect(isValidMapBounds(undefined)).toBe(false);
    expect(
      isValidMapBounds({
        minLat: 42,
        maxLat: 41,
        minLng: -88,
        maxLng: -87,
      }),
    ).toBe(false);
    expect(
      isValidMapBounds({
        minLat: -100,
        maxLat: 42,
        minLng: -88,
        maxLng: -87,
      }),
    ).toBe(false);
    expect(
      isValidMapBounds({
        minLat: 41,
        maxLat: 42,
        minLng: -200,
        maxLng: -87,
      }),
    ).toBe(false);
  });
});

describe('boundsFromRegion', () => {
  it('derives map bounds from a map region center and deltas', () => {
    const bounds = boundsFromRegion({
      latitude: 41.8781,
      longitude: -87.6298,
      latitudeDelta: 0.2,
      longitudeDelta: 0.4,
    });

    expect(bounds.minLat).toBeCloseTo(41.7781);
    expect(bounds.maxLat).toBeCloseTo(41.9781);
    expect(bounds.minLng).toBeCloseTo(-87.8298);
    expect(bounds.maxLng).toBeCloseTo(-87.4298);
  });

  it('uses absolute deltas when region values are negative', () => {
    const bounds = boundsFromRegion({
      latitude: 40,
      longitude: -75,
      latitudeDelta: -0.1,
      longitudeDelta: -0.2,
    });

    expect(bounds.minLat).toBeCloseTo(39.95);
    expect(bounds.maxLat).toBeCloseTo(40.05);
    expect(bounds.minLng).toBeCloseTo(-75.1);
    expect(bounds.maxLng).toBeCloseTo(-74.9);
  });
});

describe('clusterTrackedBusinesses', () => {
  it('returns an empty array for empty input', () => {
    expect(clusterTrackedBusinesses([], 12)).toEqual([]);
  });

  it('clusters nearby businesses and ignores invalid coordinates', () => {
    const businesses = [
      business('a', 41.8781, -87.6298),
      business('b', 41.8782, -87.6299),
      business('bad', Number.NaN, -87.63),
    ];

    const clusters = clusterTrackedBusinesses(businesses, 12);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].businesses.map((b) => b.profile_id).sort()).toEqual(['a', 'b']);
  });

  it('creates separate clusters for distant businesses at low zoom', () => {
    const businesses = [
      business('east', 40.7, -74.0),
      business('west', 34.05, -118.24),
    ];

    const clusters = clusterTrackedBusinesses(businesses, 8);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.count === 1)).toBe(true);
  });
});
