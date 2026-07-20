import {
  assertDualAttribution,
  buildDualContributionMetadata,
  formatContentContributionSyncedLog,
  formatDualPostingInitializedLog,
  mapMediaKindToContentType,
} from './content-contribution.util';
import { buildCompressedMediaResult, toCdnMediaUrl } from './content-media-cdn.util';

describe('ContentContribution dual-posting', () => {
  it('logs DUAL_POSTING_INTERFACE_INITIALIZED', () => {
    expect(formatDualPostingInitializedLog()).toContain(
      'DUAL_POSTING_INTERFACE_INITIALIZED',
    );
  });

  it('attributes both farmer and vendor in partnership metadata', () => {
    const metadata = buildDualContributionMetadata({
      authorId: 'vendor-1',
      authorType: 'VENDOR',
      contentType: mapMediaKindToContentType('video'),
      postingMode: 'PARTNERSHIP',
      partnerId: 'farmer-1',
      partnerType: 'FARMER',
      partnershipConnectionId: 'conn-1',
    });

    assertDualAttribution(metadata);
    expect(metadata.parties).toHaveLength(2);
    expect(metadata.parties.map((p) => p.contributorType).sort()).toEqual([
      'FARMER',
      'VENDOR',
    ]);
    expect(metadata.coApprovalStatus).toBe('PENDING');
    expect(metadata.contentType).toBe('VIDEO');

    const synced = formatContentContributionSyncedLog({
      postId: 'post-1',
      authorId: 'vendor-1',
      partnerId: 'farmer-1',
      contentType: 'VIDEO',
      postingMode: 'PARTNERSHIP',
    });
    expect(synced).toContain('CONTENT_CONTRIBUTION_SYNCED');
    expect(synced).toContain('PARTNER=farmer-1');
  });

  it('compresses photo assets onto CDN render URLs', () => {
    const url =
      'https://proj.supabase.co/storage/v1/object/public/vendor-media-feed/a.jpg';
    const cdn = toCdnMediaUrl(url, { kind: 'photo' });
    expect(cdn).toContain('/render/image/public/');
    expect(buildCompressedMediaResult({ publicUrl: url, kind: 'image' }).mediaCompressed).toBe(
      true,
    );
  });
});
