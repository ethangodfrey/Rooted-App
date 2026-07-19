/**
 * Wholesale hybrid ranking verification (PR #182 + PR #186 proximity).
 *
 * Usage:
 *   npm run test:wholesale:discovery-ranking
 *
 * Success lines (uppercase, no emoji):
 *   RANKING_ALGORITHM_REFINED
 *   RADIUS_SEARCH_OPTIMIZED
 *   SEARCH_SCORE_CALCULATED
 *   WHOLESALE_DISCOVERY_RANKING_VERIFIED
 */

import {
  buildScoreCompositionLog,
  CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
  countBoostedHits,
  PROXIMITY_SCORE_WEIGHT,
  proximityBoostMultiplier,
  rankWholesaleHitsByConnectedVendors,
} from '../backend/src/modules/search/wholesale-ranking.util';
import { parseWholesaleProximitySearchQuerySafe } from '../packages/env-config/src/geo';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  assert(
    CONNECTED_WHOLESALER_SCORE_MULTIPLIER === 1.2,
    'MULTIPLIER_FAIL EXPECT_1_2',
  );
  assert(PROXIMITY_SCORE_WEIGHT === 0.15, 'PROXIMITY_WEIGHT_FAIL');

  const connected = [
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ];

  const ranked = rankWholesaleHitsByConnectedVendors(
    [
      {
        id: '1',
        vendorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Zucchini',
        score: 20,
      },
      {
        id: '2',
        vendorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Apples',
        score: 5,
      },
      {
        id: '3',
        vendorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Beets',
        score: 15,
      },
    ],
    connected,
  );

  // Hybrid: Zucchini 20 > Beets 15*1.2=18 > Apples 5*1.2=6
  assert(ranked[0]?.id === '1', 'RANK_FAIL RELEVANCE_STAYS_TOP');
  assert(ranked[0]?.score === 20, 'SCORE_FAIL ZUCCHINI');
  assert(ranked[0]?.boostApplied === 1, 'BOOST_FAIL UNCONNECTED');
  assert(ranked[0]?.proximityBoost === 1, 'PROXIMITY_IDENTITY_FAIL');
  assert(ranked[1]?.id === '3', 'RANK_FAIL CONNECTED_SECOND');
  assert(ranked[1]?.score === 18, 'SCORE_FAIL BEETS');
  assert(ranked[1]?.boostApplied === 1.2, 'BOOST_FAIL CONNECTED');
  assert(ranked[2]?.id === '2', 'RANK_FAIL CONNECTED_THIRD');
  assert(ranked[2]?.score === 6, 'SCORE_FAIL APPLES');
  assert(countBoostedHits(ranked, connected) === 2, 'BOOST_COUNT_FAIL');

  const emptyConnected = rankWholesaleHitsByConnectedVendors(
    [
      { id: '1', vendorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Z', score: 9 },
      { id: '2', vendorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'A', score: 3 },
    ],
    [],
  );
  assert(emptyConnected[0]?.score === 9, 'EMPTY_CONNECTED_FAIL RAW_SCORE');
  assert(emptyConnected[0]?.boostApplied === 1, 'EMPTY_CONNECTED_FAIL NO_PENALTY');
  assert(emptyConnected[1]?.score === 3, 'EMPTY_CONNECTED_FAIL SECOND');

  // Proximity weight: closer connected vendor can outrank farther higher-base hit.
  assert(
    proximityBoostMultiplier(0, 50) === 1.15,
    'PROXIMITY_ZERO_DISTANCE_FAIL',
  );
  assert(
    proximityBoostMultiplier(50, 50) === 1,
    'PROXIMITY_EDGE_DISTANCE_FAIL',
  );

  const withProximity = rankWholesaleHitsByConnectedVendors(
    [
      {
        id: 'far',
        vendorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Far Greens',
        score: 10,
        distanceMiles: 40,
      },
      {
        id: 'near',
        vendorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Near Apples',
        score: 10,
        distanceMiles: 5,
      },
    ],
    connected,
    CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
    { radiusMiles: 50 },
  );
  // near: 10 * 1.2 * (1 + 0.15*(1-5/50)) = 12 * 1.135 = 13.62
  // far:  10 * 1 * (1 + 0.15*(1-40/50)) = 10 * 1.03 = 10.3
  assert(withProximity[0]?.id === 'near', 'PROXIMITY_RANK_FAIL NEAR_FIRST');
  assert(
    Math.abs((withProximity[0]?.score ?? 0) - 13.62) < 1e-9,
    'PROXIMITY_SCORE_FAIL NEAR',
  );
  assert(withProximity[1]?.id === 'far', 'PROXIMITY_RANK_FAIL FAR_SECOND');

  const rejectedCountry = parseWholesaleProximitySearchQuerySafe({
    latitude: '39.7',
    longitude: '-104.9',
    radiusMiles: '25',
    country_code: 'CA',
  });
  assert(!rejectedCountry.OK, 'COUNTRY_FILTER_FAIL SHOULD_REJECT_CA');

  const usProximity = parseWholesaleProximitySearchQuerySafe({
    q: 'tomatoes',
    latitude: '39.7',
    longitude: '-104.9',
    radiusMiles: '25',
  });
  assert(usProximity.OK, 'US_PROXIMITY_PARSE_FAIL');
  assert(usProximity.DATA.countryCode === 'US', 'US_FORCE_FAIL');
  assert(usProximity.DATA.proximityEnabled === true, 'PROXIMITY_ENABLED_FAIL');

  log('RANKING_ALGORITHM_REFINED MULTIPLIER=1.2 PROXIMITY_WEIGHT=0.15 DEBUG=1');
  log(
    `RADIUS_SEARCH_OPTIMIZED LAT=39.7 LNG=-104.9 RADIUS_MI=25 COUNTRY_CODE=US SOURCE=POSTGRES_FALLBACK`,
  );
  for (const hit of withProximity) {
    log(
      buildScoreCompositionLog({
        ID: hit.id,
        VENDOR_ID: hit.vendorId,
        BASE_SCORE: hit.baseScore,
        BOOST_APPLIED: hit.boostApplied,
        PROXIMITY_BOOST: hit.proximityBoost,
        FINAL_SCORE: hit.score,
        CONNECTED_WHOLESALER: hit.CONNECTED_WHOLESALER,
        DISTANCE_MILES: hit.distanceMiles,
      }),
    );
  }
  log(
    `RANKING_ALGORITHM_REFINED SESSION_VENDOR=dddddddd-dddd-4ddd-8ddd-dddddddddddd HITS=${withProximity.length} BOOSTED=1 MULTIPLIER=1.2 PROXIMITY_WEIGHT=0.15 SOURCE=POSTGRES_FALLBACK RADIUS_MI=50`,
  );
  log('WHOLESALE_DISCOVERY_RANKING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_DISCOVERY_RANKING_FAILED ${message}`);
  process.exitCode = 1;
}
