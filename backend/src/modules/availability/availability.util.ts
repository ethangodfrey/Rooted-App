/**
 * Automated Availability Scheduling helpers.
 * Telemetry: SCHEDULING_ENGINE_INITIALIZED, AVAILABILITY_SYNC_ACTIVE
 */

export type AvailabilityStatus = 'AVAILABLE' | 'BLOCKED';

export type AvailabilityBlockReason = 'CATERING' | 'MARKET';

export function formatSchedulingEngineInitializedLog(): string {
  return 'SCHEDULING_ENGINE_INITIALIZED SERVICE=AvailabilityService';
}

export function formatAvailabilitySyncActiveLog(input?: {
  vendorId?: string;
  count?: number;
}): string {
  const parts = ['AVAILABILITY_SYNC_ACTIVE'];
  if (input?.vendorId) parts.push(`VENDOR=${input.vendorId}`);
  if (input?.count != null) parts.push(`COUNT=${input.count}`);
  return parts.join(' ');
}

export function normalizeBlockReason(
  value: string | null | undefined,
): AvailabilityBlockReason | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'CATERING' || upper === 'MARKET') return upper;
  return null;
}

/**
 * Normalize a calendar date to YYYY-MM-DD (UTC date portion).
 */
export function toDateOnlyString(value: string | Date): string | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD or ISO datetime.
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function conflictWarningForReasons(
  reasons: AvailabilityBlockReason[],
): string {
  const unique = [...new Set(reasons)];
  if (unique.length === 0) return 'Conflict Detected';
  return `Conflict Detected: ${unique.join(' + ')} block`;
}
