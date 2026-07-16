import { supabase } from '@/lib/supabase';
import type { VendorType } from '@/types/database';

/** Load vendor_type for a set of vendor IDs (Explore badges / CTAs). */
export async function fetchVendorTypesByIds(
  vendorIds: string[],
): Promise<Map<string, VendorType | null>> {
  const map = new Map<string, VendorType | null>();
  const unique = [...new Set(vendorIds.filter(Boolean))];
  if (unique.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, vendor_type')
      .in('id', unique);
    if (error) return map;
    for (const row of data ?? []) {
      map.set(row.id as string, (row.vendor_type as VendorType | null) ?? null);
    }
  } catch {
    return map;
  }
  return map;
}
