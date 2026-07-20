/**
 * Meet the Makers discovery verification.
 *
 * Usage:
 *   npm run test:discovery:meet-the-makers
 *
 * Success lines (uppercase, no emoji):
 *   DISCOVERY_INTERFACE_INITIALIZED
 *   PARTNERSHIP_FEED_SYNCED
 *   MEET_THE_MAKERS_VERIFIED
 */

import {
  clampAlertRadiusKm,
  DEFAULT_ALERT_RADIUS_KM,
  isWithinAlertRadiusKm,
} from '../backend/src/modules/discovery/alert-radius.util';
import {
  formatDiscoveryInterfaceInitializedLog,
  formatPartnershipFeedSyncedLog,
  rankMakerFeed,
  type MakerFeedCandidate,
} from '../backend/src/modules/discovery/meet-the-makers.ranking.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function candidate(
  overrides: Partial<MakerFeedCandidate> = {},
): MakerFeedCandidate {
  return {
    postId: 'p1',
    vendorId: 'v1',
    eventId: 'e1',
    caption: 'Partnership update',
    mediaUrl: null,
    cdnMediaUrl: null,
    mediaType: 'image',
    contentType: 'PHOTO',
    postingMode: 'PARTNERSHIP',
    coApprovalStatus: 'APPROVED',
    contributorId: 'c1',
    contributorType: 'VENDOR',
    partnerContributorId: 'c2',
    partnerContributorType: 'FARMER',
    contributionMetadata: {},
    publishAt: new Date().toISOString(),
    vendorName: 'Vendorly Greens',
    vendorLatitude: 39.95,
    vendorLongitude: -75.16,
    vendorSpecialties: ['PRODUCE', 'HERBS'],
    partnerName: 'River Farm',
    partnerSpecialties: ['PRODUCE'],
    eventName: 'Rittenhouse Market',
    eventLatitude: 39.95,
    eventLongitude: -75.17,
    ...overrides,
  };
}

function main(): void {
  log(formatDiscoveryInterfaceInitializedLog());

  const radius = clampAlertRadiusKm(undefined);
  assert(radius === DEFAULT_ALERT_RADIUS_KM, 'DEFAULT_RADIUS_FAIL');

  const within = isWithinAlertRadiusKm(
    { latitude: 39.95, longitude: -75.16 },
    { latitude: 39.96, longitude: -75.17 },
    radius,
  );
  assert(within.within, 'RADIUS_WITHIN_FAIL');

  const ranked = rankMakerFeed(
    [
      candidate({
        postId: 'hit',
        vendorSpecialties: ['PRODUCE'],
        partnerSpecialties: ['PRODUCE'],
      }),
      candidate({
        postId: 'miss',
        vendorSpecialties: ['BAKERY'],
        partnerSpecialties: [],
        vendorLatitude: 39.951,
        vendorLongitude: -75.161,
        eventLatitude: null,
        eventLongitude: null,
      }),
      candidate({
        postId: 'far',
        vendorSpecialties: ['PRODUCE'],
        vendorLatitude: 45.0,
        vendorLongitude: -75.0,
        eventLatitude: 45.0,
        eventLongitude: -75.0,
      }),
    ],
    {
      shopperLat: 39.95,
      shopperLng: -75.16,
      alertRadiusKm: radius,
      preferredCategories: ['PRODUCE'],
      requireWithinRadius: true,
    },
  );

  assert(ranked.length === 2, `RANK_COUNT_FAIL GOT=${ranked.length}`);
  assert(ranked[0].postId === 'hit', 'RANK_ORDER_FAIL');
  assert(ranked[0].preferredCategoryHits.includes('PRODUCE'), 'CATEGORY_HIT_FAIL');

  log(
    formatPartnershipFeedSyncedLog({
      count: ranked.length,
      alertRadiusKm: radius,
    }),
  );

  log('MEET_THE_MAKERS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MEET_THE_MAKERS_FAILED ${message}`);
  process.exitCode = 1;
}
