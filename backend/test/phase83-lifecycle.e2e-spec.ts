/**
 * Phase 83 lifecycle E2E.
 *
 * Covers:
 *   V2V connection request/accept + network metrics
 *   MICRO_BRAND flash promo activation
 *   Creator media ingest + feed asset visibility
 *
 * Telemetry (uppercase, no emoji):
 *   MEDIA_ENGINE_INITIALIZED
 *   PHASE83_E2E_INITIALIZED
 *   PHASE83_E2E_VERIFIED
 */

import { ConfigService } from '@nestjs/config';

import { CreatorUploadService } from '../src/modules/media/creator-upload.service';
import { MediaStreamingService } from '../src/modules/media/media-streaming.service';
import { FlashPromoService } from '../src/modules/vendor-network/flash-promo.service';
import { parseFlashPromoCampaign } from '../src/modules/vendor-network/flash-promo.util';
import { V2vConnectionsService } from '../src/modules/vendor-network/v2v-connections.service';
import { createFakePhase83Prisma } from './fake-phase83-prisma';

const VENDOR_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VENDOR_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

function countMetrics(
  rows: Array<{
    status: string;
    senderId: string;
    receiverId: string;
    isFollowing?: boolean;
    receiverIsFollowing?: boolean;
  }>,
  vendorId: string,
) {
  let connections = 0;
  let following = 0;
  let pendingIncoming = 0;
  for (const row of rows) {
    if (row.status === 'connected') connections += 1;
    if (row.status === 'pending' && row.receiverId === vendorId) pendingIncoming += 1;
    const isSender = row.senderId === vendorId;
    if (isSender && row.isFollowing) following += 1;
    if (!isSender && row.receiverIsFollowing) following += 1;
  }
  return { connections, following, pendingIncoming };
}

/** Minimal VerticalVideoFeed mapper (mirrors web feed selection). */
function mapFeedForVerticalVideoFeed(
  rows: Array<{
    id: string;
    vendorId: string;
    vendorName: string;
    caption: string;
    mediaUrl: string;
    streamUrl: string;
    mediaType: string;
  }>,
) {
  return rows
    .map((row) => {
      const mediaUrl = row.streamUrl || row.mediaUrl;
      if (!mediaUrl) return null;
      return {
        id: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        caption: row.caption,
        mediaUrl,
        mediaType: row.mediaType === 'video' ? 'video' : 'image',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

describe('Phase 83 lifecycle E2E', () => {
  it('runs V2V → Flash promo → Media ingest → Feed', async () => {
    log('PHASE83_E2E_INITIALIZED');

    const { prisma, store } = createFakePhase83Prisma({
      vendors: [
        {
          id: VENDOR_A,
          userId: USER_A,
          businessName: 'Vendor A Kitchen',
          vendorType: 'home_kitchen',
          themeSettings: {},
        },
        {
          id: VENDOR_B,
          userId: USER_B,
          businessName: 'Vendor B Micro Brand',
          vendorType: 'micro_brand',
          themeSettings: {},
        },
      ],
    });

    const v2v = new V2vConnectionsService(prisma);
    const flash = new FlashPromoService(prisma);
    const config = {
      get: (_key: string, fallback = '') => fallback,
    } as unknown as ConfigService;
    const mediaStreaming = new MediaStreamingService(config);
    const uploads = new CreatorUploadService(prisma, mediaStreaming);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      // Keep lifecycle logs visible in the runner output.
      // eslint-disable-next-line no-console
      process.stdout.write(`${args.map(String).join(' ')}\n`);
    });

    // ------------------------------------------------------------------
    // 1) V2V — Vendor A requests Vendor B; Vendor B accepts
    // Simulates POST /api/v2v/connections then POST .../accept
    // ------------------------------------------------------------------
    log('V2V_NETWORK_ACTIVE ACTION=REQUEST_SIMULATED ROUTE=POST_/api/v2v/connections');
    const pending = await v2v.requestConnection(VENDOR_A, VENDOR_B);
    expect(pending.status).toBe('pending');
    expect(pending.senderId).toBe(VENDOR_A);
    expect(pending.receiverId).toBe(VENDOR_B);

    log(`V2V_NETWORK_ACTIVE ACTION=ACCEPT_SIMULATED ID=${pending.id}`);
    const accepted = await v2v.acceptConnection(VENDOR_B, pending.id);
    expect(accepted.status).toBe('connected');

    const listed = await v2v.listForVendor(VENDOR_A);
    const metricsA = countMetrics(
      listed as Array<{
        status: string;
        senderId: string;
        receiverId: string;
        isFollowing?: boolean;
        receiverIsFollowing?: boolean;
      }>,
      VENDOR_A,
    );
    expect(metricsA.connections).toBe(1);
    expect(metricsA.pendingIncoming).toBe(0);
    log(`V2V_NETWORK_ACTIVE CONNECTIONS=${metricsA.connections}`);

    // ------------------------------------------------------------------
    // 2) Flash promo — MICRO_BRAND Vendor B triggers sale
    // ------------------------------------------------------------------
    log('FLASH_PROMO_ACTIVE ACTION=CREATE VENDOR=MICRO_BRAND');
    const campaign = await flash.createCampaign(VENDOR_B, {
      productId: PRODUCT_ID,
      productName: 'Limited Drop Tee',
      unitsLeft: 4,
      discountPercent: 20,
    });
    expect(campaign.active).toBe(true);
    expect(campaign.discountPercent).toBe(20);
    expect(campaign.productId).toBe(PRODUCT_ID);

    const vendorB = store.vendors.find((v) => v.id === VENDOR_B);
    const parsed = parseFlashPromoCampaign(vendorB?.themeSettings);
    expect(parsed?.active).toBe(true);
    expect(parsed?.discountPercent).toBe(20);
    log(
      `FLASH_PROMO_ACTIVE PRODUCT=${campaign.productId} DISCOUNT=${campaign.discountPercent}`,
    );

    // ------------------------------------------------------------------
    // 3) Media ingest — POST /api/creator/upload simulation
    // ------------------------------------------------------------------
    log('MEDIA_UPLOAD_SIMULATED ROUTE=POST_/api/creator/upload');
    const ingested = await uploads.ingest(VENDOR_A, {
      mediaType: 'video',
      contentType: 'video/mp4',
      sizeBytes: 1_500_000,
      fileName: 'market-day.mp4',
      caption: 'Phase 83 feed clip',
    });
    expect(ingested.ACTION).toBe('MEDIA_INGESTED');
    expect(ingested.MEDIA_TYPE).toBe('video');
    expect(ingested.STREAM_URL).toContain('http');
    expect(store.posts).toHaveLength(1);
    expect(store.posts[0]?.mediaUrl).toBe(ingested.STREAM_URL);
    expect(
      consoleSpy.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes('MEDIA_ENGINE_INITIALIZED')),
      ),
    ).toBe(true);

    // ------------------------------------------------------------------
    // 4) VerticalVideoFeed fetch of new asset
    // ------------------------------------------------------------------
    const feedRows = await uploads.listFeed(12);
    const feedItems = mapFeedForVerticalVideoFeed(feedRows);
    expect(feedItems.length).toBeGreaterThanOrEqual(1);
    const clip = feedItems.find((item) => item.id === ingested.POST_ID);
    expect(clip).toBeTruthy();
    expect(clip?.mediaUrl).toBe(ingested.STREAM_URL);
    expect(clip?.mediaType).toBe('video');
    log(`CREATOR_FEED_ACTIVE COUNT=${feedItems.length} POST=${ingested.POST_ID}`);

    consoleSpy.mockRestore();
    log('PHASE83_E2E_VERIFIED');
  });
});
