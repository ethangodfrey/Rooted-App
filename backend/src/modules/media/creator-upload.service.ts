import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreatorUploadDto } from './dto/creator-upload.dto';
import { MediaStreamingService } from './media-streaming.service';

export interface CreatorUploadResult {
  ACTION: 'MEDIA_INGESTED';
  POST_ID: string;
  VENDOR_ID: string;
  MEDIA_TYPE: 'image' | 'video';
  STREAM_URL: string;
  PUBLIC_URL: string;
  THUMBNAIL_URL: string | null;
  PROVIDER: string;
  UPLOAD_URL: string;
}

@Injectable()
export class CreatorUploadService {
  private readonly logger = new Logger(CreatorUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaStreamingService,
  ) {}

  async ingest(vendorId: string, dto: CreatorUploadDto): Promise<CreatorUploadResult> {
    if (!vendorId) {
      throw new UnauthorizedException('CREATOR_UPLOAD_ERROR: VENDOR_REQUIRED');
    }

    this.media.ensureInitialized();

    const validation = this.media.validateMobileFeedPayload({
      mediaType: dto.mediaType,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
    });
    if (!validation.ok) {
      throw new BadRequestException(`CREATOR_UPLOAD_INVALID: ${validation.reason}`);
    }

    const session = this.media.createUploadSession({
      vendorId,
      mediaType: dto.mediaType,
      contentType: dto.contentType,
      fileName: dto.fileName,
    });
    const asset = this.media.finalizeAsset(session, dto.contentType);
    const streamUrl = (dto.assetUrl?.trim() || asset.streamUrl).trim();
    const playback = this.media.resolvePlaybackUrl({
      streamUrl,
      cdnMediaUrl: streamUrl,
      mediaUrl: streamUrl,
    });

    const caption =
      dto.caption?.trim() ||
      (dto.mediaType === 'video' ? 'Creator video' : 'Creator photo');

    const post = await this.prisma.post.create({
      data: {
        vendorId,
        postType: dto.mediaType === 'video' ? 'video' : 'photo',
        caption,
        content: caption,
        mediaUrl: playback,
        mediaType: dto.mediaType,
        videoThumbnailUrl: asset.thumbnailUrl,
        contentType: dto.mediaType === 'video' ? 'VIDEO' : 'PHOTO',
        postingMode: 'SELF',
        cdnMediaUrl: playback,
        mediaCompressed: true,
        contributionMetadata: {
          provider: asset.provider,
          assetKey: asset.assetKey,
          streamUrl: playback,
          uploadId: session.uploadId,
        },
      },
    });

    this.logger.log(
      `CREATOR_MEDIA_INGESTED POST=${post.id} VENDOR=${vendorId} TYPE=${dto.mediaType} PROVIDER=${asset.provider}`,
    );

    return {
      ACTION: 'MEDIA_INGESTED',
      POST_ID: post.id,
      VENDOR_ID: vendorId,
      MEDIA_TYPE: dto.mediaType,
      STREAM_URL: playback,
      PUBLIC_URL: playback,
      THUMBNAIL_URL: asset.thumbnailUrl,
      PROVIDER: asset.provider,
      UPLOAD_URL: session.uploadUrl,
    };
  }

  /** Feed helper — posts with streamable media for VerticalVideoFeed. */
  async listFeed(limit = 24) {
    this.media.ensureInitialized();
    const rows = await this.prisma.post.findMany({
      where: {
        mediaUrl: { not: null },
        OR: [{ mediaType: 'video' }, { contentType: 'VIDEO' }, { mediaType: 'image' }],
      },
      orderBy: { publishAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: {
        vendor: { select: { id: true, businessName: true } },
      },
    });

    return rows.map((row) => {
      const meta =
        row.contributionMetadata && typeof row.contributionMetadata === 'object'
          ? (row.contributionMetadata as Record<string, unknown>)
          : {};
      const streamFromMeta =
        typeof meta.streamUrl === 'string' ? meta.streamUrl : null;
      const streamUrl = this.media.resolvePlaybackUrl({
        streamUrl: streamFromMeta,
        cdnMediaUrl: row.cdnMediaUrl,
        mediaUrl: row.mediaUrl,
      });
      return {
        id: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendor?.businessName ?? 'Vendor',
        caption: row.caption,
        mediaUrl: streamUrl,
        streamUrl,
        thumbnailUrl: row.videoThumbnailUrl,
        mediaType: row.mediaType === 'video' || row.contentType === 'VIDEO' ? 'video' : 'image',
      };
    });
  }
}
