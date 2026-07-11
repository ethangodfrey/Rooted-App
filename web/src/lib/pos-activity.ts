import { api } from '@/lib/api';
import type { PosActivityDashboardResponse } from '@/types/pos-activity';

/** Fetch the vendor POS activity dashboard (last 24h aggregates + live feed). */
export async function fetchPosActivityDashboard(): Promise<PosActivityDashboardResponse> {
  return api.get<PosActivityDashboardResponse>('/pos/activity/dashboard');
}

/** Format queue latency for display (ms → human-readable). */
export function formatQueueLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Relative time label for feed rows (e.g. "2m ago"). */
export function formatRelativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - Date.parse(iso);
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return sec <= 5 ? 'just now' : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
