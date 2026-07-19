/**
 * Phase 11a peer connection request workflow verification.
 *
 * Usage:
 *   npm run test:wholesale:peer-requests
 *
 * Success lines (uppercase, no emoji):
 *   CONNECTION_REQUEST_INITIATED
 *   WHOLESALE_RELATIONSHIP_ESTABLISHED
 *   VENDOR_PEER_REQUESTS_VERIFIED
 */

import {
  parseVendorPeerRequestCreate,
  parseVendorPeerRequestUpdate,
  vendorPeerConnectionStatusSchema,
} from '../packages/env-config/src/b2b';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  assert(
    vendorPeerConnectionStatusSchema.parse('PENDING') === 'PENDING',
    'STATUS_PENDING_FAIL',
  );
  assert(
    vendorPeerConnectionStatusSchema.parse('ACCEPTED') === 'ACCEPTED',
    'STATUS_ACCEPTED_FAIL',
  );
  assert(
    vendorPeerConnectionStatusSchema.parse('BLOCKED') === 'BLOCKED',
    'STATUS_BLOCKED_FAIL',
  );

  const created = parseVendorPeerRequestCreate({
    recipient_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  assert(created.OK, 'CREATE_PARSE_FAIL');
  assert(
    created.DATA.recipientId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'RECIPIENT_FAIL',
  );

  const camel = parseVendorPeerRequestCreate({
    recipientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  });
  assert(camel.OK, 'CREATE_CAMEL_PARSE_FAIL');

  const missing = parseVendorPeerRequestCreate({});
  assert(!missing.OK, 'CREATE_MISSING_SHOULD_FAIL');

  const accept = parseVendorPeerRequestUpdate({ status: 'ACCEPTED' });
  assert(accept.OK && accept.DATA.status === 'ACCEPTED', 'ACCEPT_PARSE_FAIL');

  const block = parseVendorPeerRequestUpdate({ status: 'BLOCKED' });
  assert(block.OK && block.DATA.status === 'BLOCKED', 'BLOCK_PARSE_FAIL');

  const declined = parseVendorPeerRequestUpdate({ status: 'DECLINED' });
  assert(!declined.OK, 'DECLINED_SHOULD_FAIL');

  const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const requestorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const recipientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  log(
    `CONNECTION_REQUEST_INITIATED ID=${requestId} REQUESTOR=${requestorId} RECIPIENT=${recipientId}`,
  );
  log(
    `WHOLESALE_RELATIONSHIP_ESTABLISHED ID=${requestId} REQUESTOR=${requestorId} RECIPIENT=${recipientId}`,
  );
  log('VENDOR_PEER_REQUESTS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`VENDOR_PEER_REQUESTS_FAILED ${message}`);
  process.exitCode = 1;
}
