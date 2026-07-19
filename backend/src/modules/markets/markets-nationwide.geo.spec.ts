import {
  assertUsStateFixtureCoverage,
  boundingBoxDegrees,
  getNationwideCrossSectionFixtures,
  getStateGeoFixture,
  pointInBoundingBox,
} from '@vendorly/env-config';

describe('NATIONWIDE GEO ENGINE', () => {
  it('STATE_VALIDATION_PASSED covers all 50 states', () => {
    const coverage = assertUsStateFixtureCoverage();
    expect(coverage.OK).toBe(true);
    if (coverage.OK) {
      expect(coverage.COUNT).toBe(50);
    }
  });

  it('interstate Kansas City MO/KS radius is not clipped by state borders', () => {
    const mo = getStateGeoFixture('MO');
    const ks = getStateGeoFixture('KS');
    expect(mo).toBeTruthy();
    expect(ks).toBeTruthy();

    const box = boundingBoxDegrees(mo!.LATITUDE, mo!.LONGITUDE, 25);
    expect(pointInBoundingBox(ks!.LATITUDE, ks!.LONGITUDE, box)).toBe(true);
  });

  it('nationwide cross-section centroids stay inside contiguous bbox grids', () => {
    for (const row of getNationwideCrossSectionFixtures()) {
      const box = boundingBoxDegrees(row.LATITUDE, row.LONGITUDE, 50);
      expect(pointInBoundingBox(row.LATITUDE, row.LONGITUDE, box)).toBe(true);
      expect(
        pointInBoundingBox(row.LATITUDE + 0.2, row.LONGITUDE + 0.2, box),
      ).toBe(true);
    }
  });
});
