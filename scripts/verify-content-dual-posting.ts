/**
 * Dual-posting content contribution verification.
 *
 * Ensures partnership posts attribute both farmer and vendor parties in metadata,
 * CDN compression rewrites image URLs, and sync log markers are present.
 *
 * Usage:
 *   npm run test:content:dual-posting
 *
 * Success lines (uppercase, no emoji):
 *   DUAL_POSTING_INTERFACE_INITIALIZED
 *   CONTENT_CONTRIBUTION_SYNCED
 *   DUAL_POSTING_ATTRIBUTION_VERIFIED
 */

import {
  assertDualAttribution,
  buildDualContributionMetadata,
  formatContentContributionSyncedLog,
  formatDualPostingInitializedLog,
  mapMediaKindToContentType,
} from '../backend/src/modules/content/content-contribution.util';
import {
  buildCompressedMediaResult,
  toCdnMediaUrl,
} from '../backend/src/modules/content/content-media-cdn.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatDualPostingInitializedLog());

  const farmerId = '11111111-1111-4111-8111-111111111111';
  const vendorId = '22222222-2222-4222-8222-222222222222';
  const connectionId = '33333333-3333-4333-8333-333333333333';

  const selfMeta = buildDualContributionMetadata({
    authorId: vendorId,
    authorType: 'VENDOR',
    contentType: 'TEXT',
    postingMode: 'SELF',
  });
  assertDualAttribution(selfMeta);
  assert(selfMeta.parties.length === 1, 'SELF_PARTY_COUNT');
  assert(selfMeta.coApprovalStatus === 'NONE', 'SELF_CO_APPROVAL');

  const dualMeta = buildDualContributionMetadata({
    authorId: vendorId,
    authorType: 'VENDOR',
    contentType: mapMediaKindToContentType('photo'),
    postingMode: 'PARTNERSHIP',
    partnerId: farmerId,
    partnerType: 'FARMER',
    partnershipConnectionId: connectionId,
    mediaCompressed: true,
    cdnMediaUrl:
      'https://example.supabase.co/storage/v1/render/image/public/vendor-media-feed/x.jpg?width=1600&quality=75&resize=contain',
  });
  assertDualAttribution(dualMeta);
  assert(dualMeta.parties.length === 2, 'PARTNERSHIP_PARTY_COUNT');
  assert(
    dualMeta.parties.some(
      (p) => p.role === 'AUTHOR' && p.contributorType === 'VENDOR' && p.contributorId === vendorId,
    ),
    'MISSING_VENDOR_AUTHOR',
  );
  assert(
    dualMeta.parties.some(
      (p) => p.role === 'PARTNER' && p.contributorType === 'FARMER' && p.contributorId === farmerId,
    ),
    'MISSING_FARMER_PARTNER',
  );
  assert(dualMeta.coApprovalStatus === 'PENDING', 'PARTNERSHIP_PENDING');
  assert(dualMeta.contentType === 'PHOTO', 'CONTENT_TYPE_PHOTO');
  assert(dualMeta.partnershipConnectionId === connectionId, 'CONNECTION_ID');

  log(
    formatContentContributionSyncedLog({
      postId: '44444444-4444-4444-8444-444444444444',
      authorId: vendorId,
      partnerId: farmerId,
      contentType: 'PHOTO',
      postingMode: 'PARTNERSHIP',
    }),
  );

  const publicUrl =
    'https://xyz.supabase.co/storage/v1/object/public/vendor-media-feed/v1/photo.jpg';
  const cdn = toCdnMediaUrl(publicUrl, { kind: 'image', width: 1600, quality: 75 });
  assert(cdn.includes('/storage/v1/render/image/public/'), 'CDN_RENDER_PATH');
  assert(cdn.includes('width=1600'), 'CDN_WIDTH');
  assert(cdn.includes('quality=75'), 'CDN_QUALITY');

  const compressed = buildCompressedMediaResult({
    publicUrl,
    kind: 'photo',
  });
  assert(compressed.mediaCompressed, 'MEDIA_COMPRESSED');
  assert(compressed.cdnMediaUrl !== compressed.mediaUrl, 'CDN_DIFFERS');

  const videoPass = toCdnMediaUrl(
    'https://xyz.supabase.co/storage/v1/object/public/vendor-media-feed/v1/clip.mp4',
    { kind: 'video' },
  );
  assert(videoPass.includes('/object/public/'), 'VIDEO_PASSTHROUGH');

  let dualFail = false;
  try {
    assertDualAttribution(
      buildDualContributionMetadata({
        authorId: vendorId,
        authorType: 'VENDOR',
        contentType: 'TEXT',
        postingMode: 'PARTNERSHIP',
        // missing partner — must fail
      }),
    );
  } catch {
    dualFail = true;
  }
  assert(dualFail, 'PARTNERSHIP_WITHOUT_PARTNER_SHOULD_FAIL');

  log('DUAL_POSTING_ATTRIBUTION_VERIFIED PARTIES=VENDOR,FARMER CONTENT_TYPE=PHOTO');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DUAL_POSTING_VERIFICATION_FAILED ${message}`);
  process.exitCode = 1;
}
