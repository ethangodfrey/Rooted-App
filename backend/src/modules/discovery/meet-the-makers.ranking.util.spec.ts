import {
  clampAlertRadiusKm,
  DEFAULT_ALERT_RADIUS_KM,
  isWithinAlertRadiusKm,
} from './alert-radius.util';
import {
  formatDiscoveryInterfaceInitializedLog,
  formatPartnershipFeedSyncedLog,
  rankMakerFeed,
  type MakerFeedCandidate,
} from './meet-the-makers.ranking.util';

function baseCandidate(
  overrides: Partial<MakerFeedCandidate> = {},
): MakerFeedCandidate {
  return {
    postId: 'post-1',
    vendorId: 'vendor-1',
    eventId: 'event-1',
    caption: 'Joint harvest day',
    mediaUrl: null,
    cdnMediaUrl: null,
    mediaType: 'image',
    contentType: 'PHOTO',
    postingMode: 'PARTNERSHIP',
    coApprovalStatus: 'APPROVED',
    contributorId: 'a',
    contributorType: 'VENDOR',
    partnerContributorId: 'b',
    partnerContributorType: 'FARMER',
    contributionMetadata: {},
    publishAt: new Date().toISOString(),
    vendorName: 'Market Vendor',
    vendorLatitude: 40.0,
    vendorLongitude: -75.0,
    vendorSpecialties: ['PRODUCE'],
    partnerName: 'Local Farm',
    partnerSpecialties: ['DAIRY'],
    eventName: 'Saturday Market',
    eventLatitude: 40.01,
    eventLongitude: -75.01,
    ...overrides,
  };
}

describe('Meet the Makers discovery ranking', () => {
  it('logs DISCOVERY_INTERFACE_INITIALIZED', () => {
    expect(formatDiscoveryInterfaceInitializedLog()).toContain(
      'DISCOVERY_INTERFACE_INITIALIZED',
    );
  });

  it('prioritizes preferred categories within alert_radius_km', () => {
    const nearPreferred = baseCandidate({
      postId: 'near-pref',
      vendorSpecialties: ['PRODUCE'],
      vendorLatitude: 40.02,
      vendorLongitude: -75.02,
      eventLatitude: null,
      eventLongitude: null,
    });
    const nearOther = baseCandidate({
      postId: 'near-other',
      vendorSpecialties: ['BAKERY'],
      partnerSpecialties: [],
      vendorLatitude: 40.015,
      vendorLongitude: -75.015,
      eventLatitude: null,
      eventLongitude: null,
    });
    const farPreferred = baseCandidate({
      postId: 'far-pref',
      vendorSpecialties: ['PRODUCE'],
      vendorLatitude: 41.5,
      vendorLongitude: -75.0,
      eventLatitude: null,
      eventLongitude: null,
    });

    const ranked = rankMakerFeed([farPreferred, nearOther, nearPreferred], {
      shopperLat: 40.0,
      shopperLng: -75.0,
      alertRadiusKm: DEFAULT_ALERT_RADIUS_KM,
      preferredCategories: ['produce'],
      requireWithinRadius: true,
    });

    expect(ranked.map((r) => r.postId)).toEqual(['near-pref', 'near-other']);
    expect(ranked[0].preferredCategoryHits).toContain('PRODUCE');
    expect(
      formatPartnershipFeedSyncedLog({
        count: ranked.length,
        alertRadiusKm: DEFAULT_ALERT_RADIUS_KM,
      }),
    ).toContain('PARTNERSHIP_FEED_SYNCED');
  });

  it('uses alert_radius_km for within-radius checks', () => {
    const check = isWithinAlertRadiusKm(
      { latitude: 40, longitude: -75 },
      { latitude: 40.1, longitude: -75 },
      clampAlertRadiusKm(5),
    );
    expect(check.within).toBe(false);
  });
});
