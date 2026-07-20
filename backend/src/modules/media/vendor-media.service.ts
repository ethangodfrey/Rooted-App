import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { buildCompressedMediaResult } from '../content/content-media-cdn.util';
import type { CreateVendorUploadDto } from './dto/create-vendor-upload.dto';

const BUCKET = 'vendor-media-feed';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export interface VendorUploadToken {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
  /** CDN / render URL with compression params for images. */
  cdnPublicUrl: string;
  mediaCompressed: boolean;
}

@Injectable()
export class VendorMediaService {
  private readonly admin: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    this.admin =
      url && key
        ? createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  async createUpload(user: AuthenticatedUser, dto: CreateVendorUploadDto): Promise<VendorUploadToken> {
    if (!user.vendorId) throw new BadRequestException('Vendor profile required.');
    if (!this.admin) {
      throw new ServiceUnavailableException('Supabase service role storage client is not configured.');
    }

    this.validate(dto);
    const path = `${user.vendorId}/${dto.mediaType}s/${Date.now()}-${randomUUID()}${this.extension(dto)}`;
    const { data, error } = await this.admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      throw new ServiceUnavailableException(error?.message ?? 'Could not create signed upload URL.');
    }

    const { data: publicData } = this.admin.storage.from(BUCKET).getPublicUrl(path);
    const compressed = buildCompressedMediaResult({
      publicUrl: publicData.publicUrl,
      kind: dto.mediaType,
    });
    return {
      bucket: BUCKET,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: compressed.mediaUrl,
      cdnPublicUrl: compressed.cdnMediaUrl,
      mediaCompressed: compressed.mediaCompressed,
    };
  }

  private validate(dto: CreateVendorUploadDto): void {
    if (dto.mediaType === 'image') {
      if (!IMAGE_TYPES.has(dto.contentType)) {
        throw new BadRequestException('Images must be JPEG, PNG, or WebP.');
      }
      if (dto.sizeBytes > MAX_IMAGE_BYTES) {
        throw new BadRequestException('Images must be 5 MB or smaller.');
      }
      return;
    }

    if (!VIDEO_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Videos must be MP4, MOV, or WebM.');
    }
    if (dto.sizeBytes > MAX_VIDEO_BYTES) {
      throw new BadRequestException('Videos must be 50 MB or smaller.');
    }
  }

  private extension(dto: CreateVendorUploadDto): string {
    const fromName = dto.fileName?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    if (fromName) return fromName;
    if (dto.contentType === 'image/png') return '.png';
    if (dto.contentType === 'image/webp') return '.webp';
    if (dto.contentType === 'video/quicktime') return '.mov';
    if (dto.contentType === 'video/webm') return '.webm';
    return dto.mediaType === 'image' ? '.jpg' : '.mp4';
  }
}
