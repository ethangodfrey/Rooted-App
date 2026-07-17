import { supabase } from '@/lib/supabase';
import type { NetworkConnection, NetworkConnectionStatus } from '@/types/profiles';

export type { NetworkConnectionStatus };

export type NetworkConnectionRow = NetworkConnection;

export type NetworkConnectionUi =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'connected';

export interface NetworkConnectionView {
  row: NetworkConnectionRow | null;
  uiState: NetworkConnectionUi;
}

function empty(): NetworkConnectionView {
  return { row: null, uiState: 'none' };
}

export function toConnectionView(
  row: NetworkConnectionRow | null,
  currentProfileId: string,
): NetworkConnectionView {
  if (!row) return empty();
  if (row.status === 'connected') return { row, uiState: 'connected' };
  if (row.status === 'pending') {
    return {
      row,
      uiState: row.sender_id === currentProfileId ? 'pending_sent' : 'pending_received',
    };
  }
  return { row, uiState: 'none' };
}

/** Fetch B2B connection between two marketplace profiles (vendor/farmer). */
export async function fetchNetworkConnection(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  if (!currentProfileId || !peerProfileId || currentProfileId === peerProfileId) return empty();

  const { data, error } = await supabase
    .from('network_connections')
    .select('*')
    .or(
      `and(sender_id.eq.${currentProfileId},receiver_id.eq.${peerProfileId}),and(sender_id.eq.${peerProfileId},receiver_id.eq.${currentProfileId})`,
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toConnectionView((data as NetworkConnectionRow | null) ?? null, currentProfileId);
}

export async function sendNetworkConnectionRequest(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  if (currentProfileId === peerProfileId) throw new Error('Cannot connect with yourself');

  const existing = await fetchNetworkConnection(currentProfileId, peerProfileId);
  if (existing.row) return existing;

  const { data, error } = await supabase
    .from('network_connections')
    .insert({
      sender_id: currentProfileId,
      receiver_id: peerProfileId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as NetworkConnectionRow, currentProfileId);
}

export async function acceptNetworkConnection(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  const existing = await fetchNetworkConnection(currentProfileId, peerProfileId);
  if (!existing.row || existing.row.status !== 'pending') return existing;
  if (existing.row.receiver_id !== currentProfileId) {
    throw new Error('Only the receiver can accept this connection');
  }

  const { data, error } = await supabase
    .from('network_connections')
    .update({ status: 'connected', updated_at: new Date().toISOString() })
    .eq('id', existing.row.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as NetworkConnectionRow, currentProfileId);
}

export async function cancelNetworkConnection(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  const existing = await fetchNetworkConnection(currentProfileId, peerProfileId);
  if (!existing.row || existing.row.status !== 'pending') return existing;
  if (existing.row.sender_id !== currentProfileId) {
    throw new Error('Only the sender can cancel this request');
  }

  const { error } = await supabase
    .from('network_connections')
    .delete()
    .eq('id', existing.row.id);

  if (error) throw new Error(error.message);
  return empty();
}

/* ---- Legacy aliases (vendor_connections API shape) ---- */

/** @deprecated Prefer fetchNetworkConnection with profile ids */
export const fetchVendorConnection = fetchNetworkConnection;
/** @deprecated Prefer sendNetworkConnectionRequest */
export const sendVendorConnectionRequest = sendNetworkConnectionRequest;
/** @deprecated Prefer acceptNetworkConnection */
export const acceptVendorConnection = acceptNetworkConnection;
/** @deprecated Prefer cancelNetworkConnection */
export const cancelVendorConnection = cancelNetworkConnection;

export type VendorConnectionUi = NetworkConnectionUi;
export type VendorConnectionView = NetworkConnectionView;
export type VendorConnectionRow = NetworkConnectionRow;
export type VendorConnectionStatus = NetworkConnectionStatus;

export interface NetworkPeer {
  /** profiles.id — use for network_connections */
  profileId: string;
  role: 'vendor' | 'farmer';
  /** vendors.id when role=vendor (storefront deep link) */
  vendorId: string | null;
  displayName: string | null;
  logoUrl: string | null;
  category: string | null;
  sellCity: string | null;
  sellState: string | null;
  postalCode: string | null;
  productSummary: string | null;
  specialties: string[];
  /** @deprecated Prefer profileId */
  id: string;
  /** @deprecated Prefer displayName */
  business_name: string | null;
  logo_url: string | null;
  sell_city: string | null;
  sell_state: string | null;
  postal_code: string | null;
  product_summary: string | null;
}

/** @deprecated Prefer NetworkPeer */
export type NetworkVendor = NetworkPeer;

/** Approved vendors + farmers near a ZIP for B2B networking. */
export async function fetchLocalNetworkPeers(options: {
  currentProfileId: string;
  postalCode?: string | null;
  limit?: number;
}): Promise<NetworkPeer[]> {
  const limit = options.limit ?? 40;
  const zip = options.postalCode?.trim();
  const peers: NetworkPeer[] = [];

  let vendorQuery = supabase
    .from('vendors')
    .select(
      'id, user_id, business_name, logo_url, category, sell_city, sell_state, postal_code, product_summary',
    )
    .eq('approval_status', 'approved')
    .neq('user_id', options.currentProfileId)
    .order('business_name', { ascending: true })
    .limit(limit);

  if (zip && zip.length >= 3) {
    vendorQuery = vendorQuery.ilike('postal_code', `${zip.slice(0, 3)}%`);
  }

  const { data: vendors, error: vendorError } = await vendorQuery;
  if (vendorError) throw new Error(vendorError.message);

  for (const v of vendors ?? []) {
    peers.push({
      profileId: v.user_id,
      role: 'vendor',
      vendorId: v.id,
      displayName: v.business_name,
      logoUrl: v.logo_url,
      category: v.category,
      sellCity: v.sell_city,
      sellState: v.sell_state,
      postalCode: v.postal_code,
      productSummary: v.product_summary,
      specialties: [],
      id: v.user_id,
      business_name: v.business_name,
      logo_url: v.logo_url,
      sell_city: v.sell_city,
      sell_state: v.sell_state,
      postal_code: v.postal_code,
      product_summary: v.product_summary,
    });
  }

  let farmerQuery = supabase
    .from('farmers')
    .select('id, user_id, farm_name, logo_url, sell_city, sell_state, postal_code')
    .eq('approval_status', 'approved')
    .neq('user_id', options.currentProfileId)
    .order('farm_name', { ascending: true })
    .limit(limit);

  if (zip && zip.length >= 3) {
    farmerQuery = farmerQuery.ilike('postal_code', `${zip.slice(0, 3)}%`);
  }

  const { data: farmers, error: farmerError } = await farmerQuery;
  if (!farmerError) {
    for (const f of farmers ?? []) {
      peers.push({
        profileId: f.user_id,
        role: 'farmer',
        vendorId: null,
        displayName: f.farm_name,
        logoUrl: f.logo_url,
        category: 'Farm / harvest',
        sellCity: f.sell_city,
        sellState: f.sell_state,
        postalCode: f.postal_code,
        productSummary: null,
        specialties: [],
        id: f.user_id,
        business_name: f.farm_name,
        logo_url: f.logo_url,
        sell_city: f.sell_city,
        sell_state: f.sell_state,
        postal_code: f.postal_code,
        product_summary: null,
      });
    }
  }

  const ids = peers.map((p) => p.profileId);
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role, vendor_specialties, farmer_specialties')
      .in('id', ids);

    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          role: p.role as string | null,
          vendor_specialties: (p.vendor_specialties as string[] | null) ?? [],
          farmer_specialties: (p.farmer_specialties as string[] | null) ?? [],
        },
      ]),
    );

    for (const peer of peers) {
      const row = byId.get(peer.profileId);
      if (!row) continue;
      peer.specialties =
        peer.role === 'farmer' ? row.farmer_specialties : row.vendor_specialties;
    }
  }

  return peers.slice(0, limit);
}

/** @deprecated Prefer fetchLocalNetworkPeers with profile id */
export async function fetchLocalNetworkVendors(options: {
  currentVendorId: string;
  currentProfileId?: string;
  postalCode?: string | null;
  limit?: number;
}): Promise<NetworkPeer[]> {
  const profileId =
    options.currentProfileId ??
    (
      await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', options.currentVendorId)
        .maybeSingle()
    ).data?.user_id;

  if (!profileId) return [];
  return fetchLocalNetworkPeers({
    currentProfileId: profileId,
    postalCode: options.postalCode,
    limit: options.limit,
  });
}
