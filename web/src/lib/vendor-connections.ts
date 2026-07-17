import { supabase } from '@/lib/supabase';

export type VendorConnectionStatus = 'pending' | 'connected';

export interface VendorConnectionRow {
  id: string;
  sender_vendor_id: string;
  receiver_vendor_id: string;
  status: VendorConnectionStatus;
  created_at: string;
  updated_at: string;
}

export type VendorConnectionUi =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'connected';

export interface VendorConnectionView {
  row: VendorConnectionRow | null;
  uiState: VendorConnectionUi;
}

function empty(): VendorConnectionView {
  return { row: null, uiState: 'none' };
}

export function toConnectionView(
  row: VendorConnectionRow | null,
  currentVendorId: string,
): VendorConnectionView {
  if (!row) return empty();
  if (row.status === 'connected') return { row, uiState: 'connected' };
  if (row.status === 'pending') {
    return {
      row,
      uiState: row.sender_vendor_id === currentVendorId ? 'pending_sent' : 'pending_received',
    };
  }
  return { row, uiState: 'none' };
}

export async function fetchVendorConnection(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  if (!currentVendorId || !peerVendorId || currentVendorId === peerVendorId) return empty();

  const { data, error } = await supabase
    .from('vendor_connections')
    .select('*')
    .or(
      `and(sender_vendor_id.eq.${currentVendorId},receiver_vendor_id.eq.${peerVendorId}),and(sender_vendor_id.eq.${peerVendorId},receiver_vendor_id.eq.${currentVendorId})`,
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toConnectionView((data as VendorConnectionRow | null) ?? null, currentVendorId);
}

export async function sendVendorConnectionRequest(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  if (currentVendorId === peerVendorId) throw new Error('Cannot connect with yourself');

  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);
  if (existing.row) return existing;

  const { data, error } = await supabase
    .from('vendor_connections')
    .insert({
      sender_vendor_id: currentVendorId,
      receiver_vendor_id: peerVendorId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as VendorConnectionRow, currentVendorId);
}

export async function acceptVendorConnection(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);
  if (!existing.row || existing.row.receiver_vendor_id !== currentVendorId) {
    throw new Error('No inbound request to accept');
  }

  const { data, error } = await supabase
    .from('vendor_connections')
    .update({ status: 'connected' })
    .eq('id', existing.row.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as VendorConnectionRow, currentVendorId);
}

export interface NetworkVendor {
  id: string;
  business_name: string | null;
  logo_url: string | null;
  category: string | null;
  sell_city: string | null;
  sell_state: string | null;
  postal_code: string | null;
  product_summary: string | null;
}

/** Active approved vendors near a ZIP (postal prefix match). */
export async function fetchLocalNetworkVendors(options: {
  currentVendorId: string;
  postalCode?: string | null;
  limit?: number;
}): Promise<NetworkVendor[]> {
  const limit = options.limit ?? 40;
  let query = supabase
    .from('vendors')
    .select(
      'id, business_name, logo_url, category, sell_city, sell_state, postal_code, product_summary',
    )
    .eq('approval_status', 'approved')
    .neq('id', options.currentVendorId)
    .order('business_name', { ascending: true })
    .limit(limit);

  const zip = options.postalCode?.trim();
  if (zip && zip.length >= 3) {
    query = query.ilike('postal_code', `${zip.slice(0, 3)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as NetworkVendor[]) ?? [];
}
