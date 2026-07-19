import { boundingBoxDegrees, parseNearbyMarketsQuerySafe } from '@vendorly/env-config';

import { MarketsNearbyService } from './markets-nearby.service';

describe('nationwide geo query contract', () => {
  it('parses latitude longitude radius securely', () => {
    const parsed = parseNearbyMarketsQuerySafe({
      latitude: '39.7392',
      longitude: '-104.9903',
      radiusMiles: '25',
      limit: '10',
    });
    expect(parsed.OK).toBe(true);
    if (!parsed.OK) return;
    expect(parsed.DATA.latitude).toBeCloseTo(39.7392);
    expect(parsed.DATA.longitude).toBeCloseTo(-104.9903);
    expect(parsed.DATA.radiusMiles).toBe(25);
    expect(parsed.DATA.limit).toBe(10);
  });

  it('rejects invalid coordinates', () => {
    const parsed = parseNearbyMarketsQuerySafe({
      latitude: '999',
      longitude: '-104.9903',
    });
    expect(parsed.OK).toBe(false);
  });

  it('builds a bounding box for index prefilter', () => {
    const box = boundingBoxDegrees(39.7392, -104.9903, 25);
    expect(box.minLat).toBeLessThan(39.7392);
    expect(box.maxLat).toBeGreaterThan(39.7392);
    expect(box.minLng).toBeLessThan(-104.9903);
    expect(box.maxLng).toBeGreaterThan(-104.9903);
  });

  it('profiles bounding-box plan and still returns nearby rows', async () => {
    const explain = [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Index Name': 'markets_lat_lng_idx',
          'Relation Name': 'markets',
        },
      },
    ];
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(explain)
      .mockResolvedValueOnce([
        {
          id: 'm1',
          name: 'Denver Market',
          slug: 'denver',
          directory_slug: 'co-denver',
          city: 'Denver',
          state: 'CO',
          location_address: 'Union Station',
          operating_hours: 'Sat 9-14',
          latitude: 39.75,
          longitude: -105.0,
          distance_miles: 1.2,
          vendor_count: 3,
        },
      ]);

    const previous = process.env.GEO_QUERY_PROFILE;
    process.env.GEO_QUERY_PROFILE = '1';
    try {
      const service = new MarketsNearbyService({ $queryRaw: queryRaw } as never);
      const rows = await service.findNearby({
        latitude: 39.7392,
        longitude: -104.9903,
        radiusMiles: 25,
        limit: 10,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.directorySlug).toBe('co-denver');
      expect(queryRaw).toHaveBeenCalledTimes(2);
    } finally {
      if (previous === undefined) delete process.env.GEO_QUERY_PROFILE;
      else process.env.GEO_QUERY_PROFILE = previous;
    }
  });
});
