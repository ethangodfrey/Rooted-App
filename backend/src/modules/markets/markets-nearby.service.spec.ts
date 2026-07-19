import { boundingBoxDegrees, parseNearbyMarketsQuerySafe } from '@vendorly/env-config';

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
});
