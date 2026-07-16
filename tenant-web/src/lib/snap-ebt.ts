/**
 * Fetch vendor IDs that accept SNAP/EBT or sell at least one SNAP-eligible SKU.
 * Uses Supabase REST from the browser when env is exposed, otherwise via relative API.
 */
export async function fetchSnapEligibleVendorIds(apiBaseUrl = ''): Promise<Set<string>> {
  const res = await fetch(`${apiBaseUrl}/api/explore/snap-vendors`, { cache: 'no-store' });
  if (!res.ok) return new Set();
  const body = (await res.json().catch(() => null)) as { vendorIds?: string[] } | null;
  return new Set(Array.isArray(body?.vendorIds) ? body.vendorIds : []);
}

export const SNAP_EBT_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300';
