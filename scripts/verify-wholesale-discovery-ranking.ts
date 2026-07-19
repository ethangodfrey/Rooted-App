/**
 * Wholesale relationship-aware hybrid ranking verification (PR #182).
 *
 * Usage:
 *   npm run test:wholesale:discovery-ranking
 *
 * Success lines (uppercase, no emoji):
 *   RANKING_ALGORITHM_REFINED
 *   SEARCH_SCORE_CALCULATED
 *   WHOLESALE_DISCOVERY_RANKING_VERIFIED
 */

import {
  buildScoreCompositionLog,
  CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
  countBoostedHits,
  rankWholesaleHitsByConnectedVendors,
} from '../backend/src/modules/search/wholesale-ranking.util';

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

  log('RANKING_ALGORITHM_REFINED MULTIPLIER=1.2 DEBUG=1');
  for (const hit of ranked) {
    log(
      buildScoreCompositionLog({
        ID: hit.id,
        VENDOR_ID: hit.vendorId,
        BASE_SCORE: hit.baseScore,
        BOOST_APPLIED: hit.boostApplied,
        FINAL_SCORE: hit.score,
        CONNECTED_WHOLESALER: hit.CONNECTED_WHOLESALER,
      }),
    );
  }
  log(
    `RANKING_ALGORITHM_REFINED SESSION_VENDOR=dddddddd-dddd-4ddd-8ddd-dddddddddddd HITS=${ranked.length} BOOSTED=2 MULTIPLIER=1.2 SOURCE=POSTGRES_FALLBACK`,
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
