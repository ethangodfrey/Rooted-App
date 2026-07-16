/**
 * Fetch vendor IDs that accept SNAP/EBT or sell at least one SNAP-eligible SKU.
 * Passes `snap=true|false` through to `/api/explore/snap-vendors`.
 */
export async function fetchSnapEligibleVendorIds(
  apiBaseUrl = '',
  snapEnabled = true,
): Promise<Set<string>> {
  const params = new URLSearchParams({
    snap: snapEnabled ? 'true' : 'false',
    accepts_snap_ebt: snapEnabled ? 'true' : 'false',
  });
  const res = await fetch(`${apiBaseUrl}/api/explore/snap-vendors?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return new Set();
  const body = (await res.json().catch(() => null)) as { vendorIds?: string[] } | null;
  return new Set(Array.isArray(body?.vendorIds) ? body.vendorIds : []);
}

export const SNAP_EBT_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300';
