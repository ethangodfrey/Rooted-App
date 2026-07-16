import { supabase } from '@/lib/supabase';

/** Load vendor IDs that accept SNAP/EBT or sell at least one SNAP-eligible SKU. */
export async function fetchSnapEligibleVendorIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  try {
    const [vendorsRes, productsRes] = await Promise.all([
      supabase
        .from('vendors')
        .select('id')
        .eq('accepts_snap_ebt', true)
        .eq('approval_status', 'approved'),
      supabase
        .from('products')
        .select('vendor_id')
        .eq('is_snap_eligible', true)
        .eq('status', 'active'),
    ]);

    // Phase 49 columns may not exist yet — treat lookup errors as empty filter set.
    if (vendorsRes.error || productsRes.error) {
      return ids;
    }

    for (const row of vendorsRes.data ?? []) {
      if (row.id) ids.add(row.id as string);
    }
    for (const row of productsRes.data ?? []) {
      if (row.vendor_id) ids.add(row.vendor_id as string);
    }
  } catch {
    return ids;
  }

  return ids;
}

/** Market/event IDs with at least one approved SNAP-capable attending vendor. */
export async function fetchSnapEligibleEventIds(eventIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (eventIds.length === 0) return ids;

  const snapVendors = await fetchSnapEligibleVendorIds();
  if (snapVendors.size === 0) return ids;

  const { data } = await supabase
    .from('vendor_events')
    .select('event_id, vendor_id')
    .in('event_id', eventIds)
    .eq('participation_status', 'approved');

  for (const row of data ?? []) {
    const vendorId = row.vendor_id as string | null;
    const eventId = row.event_id as string | null;
    if (vendorId && eventId && snapVendors.has(vendorId)) {
      ids.add(eventId);
    }
  }

  return ids;
}

/** Emerald SNAP/EBT label for product cards (`bg-emerald-950 text-emerald-300 border-emerald-800`). */
export const SNAP_EBT_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300';

/** @deprecated Prefer SNAP_EBT_BADGE_CLASS */
export const SNAP_BADGE_CLASS = SNAP_EBT_BADGE_CLASS;
