/**
 * Client helpers for creator media streaming URLs (Mux / S3 / CDN).
 */

export function resolveCreatorStreamUrl(input: {
  streamUrl?: string | null;
  cdnMediaUrl?: string | null;
  mediaUrl?: string | null;
  contributionMetadata?: Record<string, unknown> | null;
}): string {
  const metaStream =
    input.contributionMetadata &&
    typeof input.contributionMetadata.streamUrl === 'string'
      ? input.contributionMetadata.streamUrl
      : null;
  return (
    input.streamUrl?.trim() ||
    metaStream?.trim() ||
    input.cdnMediaUrl?.trim() ||
    input.mediaUrl?.trim() ||
    ''
  );
}

export function isStreamableFeedUrl(url: string): boolean {
  const value = url.trim().toLowerCase();
  if (!value) return false;
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.endsWith('.m3u8') ||
    value.endsWith('.mp4') ||
    value.endsWith('.webm') ||
    value.endsWith('.mov')
  );
}
