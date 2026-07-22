/**
 * Phase 83 — media streaming / upload scaffolding (Mux + AWS S3 ready).
 * Logs: MEDIA_ENGINE_INITIALIZED (uppercase, no emoji).
 */

import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MOBILE_FEED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export const MOBILE_FEED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type MediaProvider = 'MUX' | 'S3' | 'SUPABASE' | 'LOCAL_STUB';

export interface MediaUploadSession {
  provider: MediaProvider;
  uploadId: string;
  assetKey: string;
  /** PUT / POST target for the binary (signed when provider is live). */
  uploadUrl: string;
  /** Playback / HLS / progressive URL for VerticalVideoFeed. */
  streamUrl: string;
  /** Thumbnail / poster when available. */
  thumbnailUrl: string | null;
  expiresAt: string;
}

export interface MediaAssetRecord {
  provider: MediaProvider;
  assetKey: string;
  streamUrl: string;
  publicUrl: string;
  thumbnailUrl: string | null;
  contentType: string;
  mediaType: 'image' | 'video';
}

@Injectable()
export class MediaStreamingService {
  private readonly logger = new Logger(MediaStreamingService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  /** Boot strap — safe to call repeatedly. */
  ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.logger.log(
      `MEDIA_ENGINE_INITIALIZED PROVIDER=${this.resolveProvider()} MUX=${this.hasMux() ? '1' : '0'} S3=${this.hasS3() ? '1' : '0'}`,
    );
    // Also emit to stdout for E2E / script captures.
    // eslint-disable-next-line no-console
    console.log('MEDIA_ENGINE_INITIALIZED');
  }

  resolveProvider(): MediaProvider {
    if (this.hasMux()) return 'MUX';
    if (this.hasS3()) return 'S3';
    if (this.config.get<string>('SUPABASE_URL', '').trim()) return 'SUPABASE';
    return 'LOCAL_STUB';
  }

  isMobileFeedVideo(contentType: string): boolean {
    return MOBILE_FEED_VIDEO_TYPES.has(contentType.trim().toLowerCase());
  }

  isMobileFeedImage(contentType: string): boolean {
    return MOBILE_FEED_IMAGE_TYPES.has(contentType.trim().toLowerCase());
  }

  validateMobileFeedPayload(input: {
    mediaType: 'image' | 'video';
    contentType: string;
    sizeBytes: number;
  }): { ok: true } | { ok: false; reason: string } {
    const type = input.contentType.trim().toLowerCase();
    if (input.mediaType === 'video') {
      if (!this.isMobileFeedVideo(type)) {
        return { ok: false, reason: 'UNSUPPORTED_VIDEO_FORMAT' };
      }
      if (input.sizeBytes > 50 * 1024 * 1024) {
        return { ok: false, reason: 'VIDEO_TOO_LARGE' };
      }
      return { ok: true };
    }
    if (!this.isMobileFeedImage(type)) {
      return { ok: false, reason: 'UNSUPPORTED_IMAGE_FORMAT' };
    }
    if (input.sizeBytes > 5 * 1024 * 1024) {
      return { ok: false, reason: 'IMAGE_TOO_LARGE' };
    }
    return { ok: true };
  }

  /**
   * Create an upload session. When Mux/S3 credentials are absent, returns a
   * deterministic LOCAL_STUB session suitable for E2E and local UI wiring.
   */
  createUploadSession(input: {
    vendorId: string;
    mediaType: 'image' | 'video';
    contentType: string;
    fileName?: string;
  }): MediaUploadSession {
    this.ensureInitialized();
    const provider = this.resolveProvider();
    const uploadId = randomUUID();
    const ext = this.extensionFor(input.contentType, input.fileName, input.mediaType);
    const assetKey = `creators/${input.vendorId}/${input.mediaType}s/${Date.now()}-${uploadId}${ext}`;
    const base = this.publicAssetBase();
    const streamUrl = this.buildStreamUrl(provider, assetKey, base);
    const uploadUrl = this.buildUploadUrl(provider, assetKey, base);

    this.logger.log(
      `MEDIA_UPLOAD_SESSION PROVIDER=${provider} KEY=${assetKey} TYPE=${input.mediaType}`,
    );

    return {
      provider,
      uploadId,
      assetKey,
      uploadUrl,
      streamUrl,
      thumbnailUrl:
        input.mediaType === 'video' ? `${streamUrl.replace(/\.[^.]+$/, '')}-poster.jpg` : null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  /** Resolve a playback URL for VerticalVideoFeed from a stored asset. */
  resolvePlaybackUrl(asset: {
    streamUrl?: string | null;
    cdnMediaUrl?: string | null;
    mediaUrl?: string | null;
    publicUrl?: string | null;
  }): string {
    this.ensureInitialized();
    return (
      asset.streamUrl?.trim() ||
      asset.cdnMediaUrl?.trim() ||
      asset.mediaUrl?.trim() ||
      asset.publicUrl?.trim() ||
      ''
    );
  }

  finalizeAsset(session: MediaUploadSession, contentType: string): MediaAssetRecord {
    this.ensureInitialized();
    return {
      provider: session.provider,
      assetKey: session.assetKey,
      streamUrl: session.streamUrl,
      publicUrl: session.streamUrl,
      thumbnailUrl: session.thumbnailUrl,
      contentType,
      mediaType: contentType.startsWith('video/') ? 'video' : 'image',
    };
  }

  private hasMux(): boolean {
    return Boolean(
      this.config.get<string>('MUX_TOKEN_ID', '').trim() &&
        this.config.get<string>('MUX_TOKEN_SECRET', '').trim(),
    );
  }

  private hasS3(): boolean {
    return Boolean(
      this.config.get<string>('AWS_S3_BUCKET', '').trim() &&
        this.config.get<string>('AWS_ACCESS_KEY_ID', '').trim(),
    );
  }

  private publicAssetBase(): string {
    const configured = this.config.get<string>('MEDIA_PUBLIC_BASE_URL', '').trim();
    if (configured) return configured.replace(/\/$/, '');
    const supabase = this.config.get<string>('SUPABASE_URL', '').trim().replace(/\/$/, '');
    if (supabase) {
      return `${supabase}/storage/v1/object/public/vendor-media-feed`;
    }
    return 'https://media.vendorly.local/stub';
  }

  private buildStreamUrl(provider: MediaProvider, assetKey: string, base: string): string {
    if (provider === 'MUX') {
      // Placeholder Mux playback shape until live credentials are wired.
      return `https://stream.mux.com/${assetKey}.m3u8`;
    }
    return `${base}/${assetKey}`;
  }

  private buildUploadUrl(provider: MediaProvider, assetKey: string, base: string): string {
    if (provider === 'S3') {
      return `${base}/upload/${assetKey}?X-Amz-Signed=stub`;
    }
    if (provider === 'MUX') {
      return `https://upload.mux.com/${assetKey}`;
    }
    return `${base}/upload/${assetKey}`;
  }

  private extensionFor(
    contentType: string,
    fileName: string | undefined,
    mediaType: 'image' | 'video',
  ): string {
    const fromName = fileName?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    if (fromName) return fromName;
    const type = contentType.toLowerCase();
    if (type === 'image/png') return '.png';
    if (type === 'image/webp') return '.webp';
    if (type === 'video/quicktime') return '.mov';
    if (type === 'video/webm') return '.webm';
    return mediaType === 'image' ? '.jpg' : '.mp4';
  }
}
