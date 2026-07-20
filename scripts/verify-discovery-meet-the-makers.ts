/**
 * Meet the Makers discovery verification (US farmers markets + USDA helpers).
 *
 * Usage:
 *   npm run test:discovery:meet-the-makers
 *
 * Success lines (uppercase, no emoji):
 *   DISCOVERY_INTERFACE_INITIALIZED
 *   PARTNERSHIP_FEED_SYNCED
 *   USDA_MARKET_DATA_SYNCED
 *   MEET_THE_MAKERS_VERIFIED
 */

import {
  clampAlertRadiusKm,
  DEFAULT_ALERT_RADIUS_KM,
  isWithinAlertRadiusKm,
} from '../backend/src/modules/discovery/alert-radius.util';
import {
  formatUsdaApiKeyStatusLog,
  formatUsdaMarketDataSyncedLog,
  isUsMarketContext,
  normalizeUsStateAbbr,
  parseUsdaExternalId,
} from '../backend/src/modules/discovery/meet-the-makers-usda.util';
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
    vendorCountry: 'US',
    vendorSpecialties: ['PRODUCE', 'HERBS'],
    partnerName: 'River Farm',
    partnerSpecialties: ['PRODUCE'],
    eventName: 'Rittenhouse Market',
    eventLatitude: 39.95,
    eventLongitude: -75.17,
    eventCity: 'Philadelphia',
    eventState: 'PA',
    eventAddress: '18th & Walnut',
    eventHoursSummary: 'Saturdays 9am–1pm',
    externalSource: 'usda',
    externalId: 'farmersmarket:12345',
    isUsMarket: true,
    usdaListingId: '12345',
    usdaDirectory: 'farmersmarket',
    usdaHoursSummary: null,
    usdaSeasonLabel: null,
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

  const parsed = parseUsdaExternalId('farmersmarket:99887');
  assert(parsed?.directory === 'farmersmarket', 'USDA_PARSE_DIR_FAIL');
  assert(parsed?.listingId === '99887', 'USDA_PARSE_ID_FAIL');
  assert(normalizeUsStateAbbr('Pennsylvania') === 'PA', 'US_STATE_FAIL');
  assert(
    isUsMarketContext({
      vendorCountry: 'USA',
      eventState: 'PA',
      externalSource: 'usda',
    }),
    'US_CONTEXT_FAIL',
  );
  assert(
    !isUsMarketContext({
      vendorCountry: 'CA',
      eventState: 'ON',
      externalSource: null,
    }),
    'NON_US_CONTEXT_FAIL',
  );

  const ranked = rankMakerFeed(
    [
      candidate({
        postId: 'hit',
        vendorSpecialties: ['PRODUCE'],
        partnerSpecialties: ['PRODUCE'],
        usdaHoursSummary: 'Saturday: 09:00 AM – 01:00 PM',
      }),
      candidate({
        postId: 'miss',
        vendorSpecialties: ['BAKERY'],
        partnerSpecialties: [],
        vendorLatitude: 39.951,
        vendorLongitude: -75.161,
        eventLatitude: null,
        eventLongitude: null,
        usdaListingId: null,
        externalId: null,
        externalSource: null,
      }),
      candidate({
        postId: 'far',
        vendorSpecialties: ['PRODUCE'],
        vendorLatitude: 45.0,
        vendorLongitude: -75.0,
        eventLatitude: 45.0,
        eventLongitude: -75.0,
      }),
      candidate({
        postId: 'intl',
        isUsMarket: false,
        vendorCountry: 'MX',
        eventState: null,
        usdaListingId: null,
        externalSource: null,
        vendorSpecialties: ['PRODUCE'],
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

  assert(ranked.length === 3, `RANK_COUNT_FAIL GOT=${ranked.length}`);
  assert(ranked[0].postId === 'hit', 'RANK_ORDER_FAIL');
  assert(ranked[0].preferredCategoryHits.includes('PRODUCE'), 'CATEGORY_HIT_FAIL');
  assert(
    ranked[0].operatingHours === 'Saturday: 09:00 AM – 01:00 PM',
    'HOURS_FAIL',
  );
  assert(ranked.some((item) => item.postId === 'miss'), 'MISS_WITHIN_FAIL');
  assert(!ranked.some((item) => item.postId === 'far'), 'FAR_FILTER_FAIL');
  assert(ranked.find((item) => item.postId === 'hit')!.isUsMarket, 'US_FLAG_FAIL');

  log(
    formatPartnershipFeedSyncedLog({
      count: ranked.length,
      alertRadiusKm: radius,
      region: 'US',
    }),
  );
  log(formatUsdaMarketDataSyncedLog({ enriched: 1, directoryHits: 12 }));
  log(formatUsdaApiKeyStatusLog());

  log('MEET_THE_MAKERS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MEET_THE_MAKERS_FAILED ${message}`);
  process.exitCode = 1;
}
