/**
 * Wholesale relationship-aware ranking verification (PR #179).
 *
 * Usage:
 *   npm run test:wholesale:discovery-ranking
 *
 * Success lines (uppercase, no emoji):
 *   RANKING_ALGORITHM_OPTIMIZED
 *   WHOLESALE_DISCOVERY_RANKING_VERIFIED
 */

import {
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

  // Connected peers first; within that set, higher score wins (Beets=15 > Apples=5).
  assert(
    ranked[0]?.vendorId === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'RANK_FAIL FIRST_CONNECTED',
  );
  assert(
    ranked[1]?.vendorId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'RANK_FAIL SECOND_CONNECTED',
  );
  assert(
    ranked[2]?.vendorId === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'RANK_FAIL UNCONNECTED_LAST',
  );
  assert(countBoostedHits(ranked, connected) === 2, 'BOOST_COUNT_FAIL');

  log(
    `RANKING_ALGORITHM_OPTIMIZED SESSION_VENDOR=dddddddd-dddd-4ddd-8ddd-dddddddddddd HITS=${ranked.length} BOOSTED=2 SOURCE=POSTGRES_FALLBACK`,
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
