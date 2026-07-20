/**
 * Media compression + CDN URL helpers for dual-posting assets.
 * Uses Supabase public storage URLs with image transform / CDN-friendly paths.
 */

const SUPABASE_PUBLIC_MARKER = '/storage/v1/object/public/';
const SUPABASE_RENDER_MARKER = '/storage/v1/render/image/public/';

export type CompressibleMediaKind = 'image' | 'video' | 'photo';

export function isImageMedia(kind: CompressibleMediaKind | string): boolean {
  return kind === 'image' || kind === 'photo' || kind === 'PHOTO';
}

/**
 * Rewrite a Supabase public object URL to the image render/CDN endpoint with
 * width + quality compression. Non-image URLs pass through unchanged.
 */
export function toCdnMediaUrl(
  publicUrl: string,
  options?: { width?: number; quality?: number; kind?: CompressibleMediaKind | string },
): string {
  const url = (publicUrl ?? '').trim();
  if (!url) return url;

  const kind = options?.kind ?? 'image';
  if (!isImageMedia(kind)) {
    return url;
  }

  const width = options?.width ?? 1600;
  const quality = options?.quality ?? 75;

  let cdn = url;
  if (url.includes(SUPABASE_PUBLIC_MARKER)) {
    cdn = url.replace(SUPABASE_PUBLIC_MARKER, SUPABASE_RENDER_MARKER);
  }

  const separator = cdn.includes('?') ? '&' : '?';
  if (/[?&]width=/.test(cdn)) {
    return cdn;
  }
  return `${cdn}${separator}width=${width}&quality=${quality}&resize=contain`;
}

export function buildCompressedMediaResult(input: {
  publicUrl: string;
  kind: CompressibleMediaKind | string;
  width?: number;
  quality?: number;
}): {
  mediaUrl: string;
  cdnMediaUrl: string;
  mediaCompressed: boolean;
} {
  const mediaUrl = input.publicUrl.trim();
  const cdnMediaUrl = toCdnMediaUrl(mediaUrl, {
    kind: input.kind,
    width: input.width,
    quality: input.quality,
  });
  return {
    mediaUrl,
    cdnMediaUrl,
    mediaCompressed: cdnMediaUrl !== mediaUrl || isImageMedia(input.kind),
  };
}
