import {
  isFarmerSpecialty,
  isVendorSpecialty,
} from '@/lib/specialties';
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
  // ignored → treat as none so a fresh request can be sent (upsert updates row)
  return { row, uiState: 'none' };
}

const CONNECTIONS_TABLE = 'vendor_connections';

/** Fetch B2B connection between two marketplace profiles (vendor/farmer). */
export async function fetchNetworkConnection(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  if (!currentProfileId || !peerProfileId || currentProfileId === peerProfileId) return empty();

  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
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
  if (existing.row?.status === 'pending' || existing.row?.status === 'connected') {
    return existing;
  }

  if (existing.row?.status === 'ignored') {
    const { data, error } = await supabase
      .from(CONNECTIONS_TABLE)
      .update({
        sender_id: currentProfileId,
        receiver_id: peerProfileId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.row.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return toConnectionView(data as NetworkConnectionRow, currentProfileId);
  }

  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
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
    .from(CONNECTIONS_TABLE)
    .update({ status: 'connected', updated_at: new Date().toISOString() })
    .eq('id', existing.row.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Thread is also created by DB trigger; ensure client has the id
  await ensureB2bThread(existing.row.id);

  return toConnectionView(data as NetworkConnectionRow, currentProfileId);
}

export async function ignoreNetworkConnection(
  currentProfileId: string,
  peerProfileId: string,
): Promise<NetworkConnectionView> {
  const existing = await fetchNetworkConnection(currentProfileId, peerProfileId);
  if (!existing.row || existing.row.status !== 'pending') return existing;
  if (existing.row.receiver_id !== currentProfileId) {
    throw new Error('Only the receiver can ignore this connection');
  }

  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .update({ status: 'ignored', updated_at: new Date().toISOString() })
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

  const { error } = await supabase.from(CONNECTIONS_TABLE).delete().eq('id', existing.row.id);

  if (error) throw new Error(error.message);
  return empty();
}

/** Pending inbound B2B requests for the NETWORK REQUESTS inbox tab. */
export async function fetchPendingNetworkRequests(
  currentProfileId: string,
): Promise<NetworkConnectionRow[]> {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select('*')
    .eq('receiver_id', currentProfileId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as NetworkConnectionRow[]) ?? [];
}

/** Connected peers for CHATS tab (B2B). */
export async function fetchConnectedNetworkRows(
  currentProfileId: string,
): Promise<NetworkConnectionRow[]> {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select('*')
    .eq('status', 'connected')
    .or(`sender_id.eq.${currentProfileId},receiver_id.eq.${currentProfileId}`)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as NetworkConnectionRow[]) ?? [];
}

export async function ensureB2bThread(connectionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_b2b_conversation_thread', {
    p_connection_id: connectionId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchThreadIdForConnection(connectionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select('id')
    .eq('vendor_connection_id', connectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function resolveMessageThreadForPeer(
  currentProfileId: string,
  peerProfileId: string,
): Promise<string | null> {
  const view = await fetchNetworkConnection(currentProfileId, peerProfileId);
  if (!view.row || view.row.status !== 'connected') return null;
  const existing = await fetchThreadIdForConnection(view.row.id);
  if (existing) return existing;
  return ensureB2bThread(view.row.id);
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
  roleFilter?: 'all' | 'vendor' | 'farmer';
  /** Specialty tokens — profiles must overlap these arrays (Postgres `&&`). */
  specialtyFilters?: string[];
}): Promise<NetworkPeer[]> {
  const limit = options.limit ?? 40;
  const zip = options.postalCode?.trim();
  const roleFilter = options.roleFilter ?? 'all';
  const specialtyFilters = (options.specialtyFilters ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  let allowedProfileIds: Set<string> | null = null;

  if (specialtyFilters.length > 0) {
    const vendorTags = specialtyFilters.filter(isVendorSpecialty);
    const farmerTags = specialtyFilters.filter(isFarmerSpecialty);
    const orParts: string[] = [];
    if (vendorTags.length > 0 && roleFilter !== 'farmer') {
      orParts.push(`and(role.eq.vendor,vendor_specialties.ov.{${vendorTags.join(',')}})`);
    }
    if (farmerTags.length > 0 && roleFilter !== 'vendor') {
      orParts.push(`and(role.eq.farmer,farmer_specialties.ov.{${farmerTags.join(',')}})`);
    }

    if (orParts.length === 0) {
      return [];
    }

    const { data: matched, error: matchError } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', options.currentProfileId)
      .or(orParts.join(','));

    if (matchError) throw new Error(matchError.message);
    allowedProfileIds = new Set((matched ?? []).map((row) => row.id as string));
    if (allowedProfileIds.size === 0) return [];
  }

  const peers: NetworkPeer[] = [];
  const includeVendors = roleFilter === 'all' || roleFilter === 'vendor';
  const includeFarmers = roleFilter === 'all' || roleFilter === 'farmer';

  if (includeVendors) {
    let vendorQuery = supabase
      .from('vendors')
      .select(
        'id, user_id, business_name, logo_url, category, sell_city, sell_state, postal_code, product_summary',
      )
      .eq('approval_status', 'approved')
      .neq('user_id', options.currentProfileId)
      .order('business_name', { ascending: true })
      .limit(limit);

    if (allowedProfileIds) {
      vendorQuery = vendorQuery.in('user_id', [...allowedProfileIds]);
    }
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
  }

  if (includeFarmers) {
    let farmerQuery = supabase
      .from('farmers')
      .select('id, user_id, farm_name, logo_url, sell_city, sell_state, postal_code')
      .eq('approval_status', 'approved')
      .neq('user_id', options.currentProfileId)
      .order('farm_name', { ascending: true })
      .limit(limit);

    if (allowedProfileIds) {
      farmerQuery = farmerQuery.in('user_id', [...allowedProfileIds]);
    }
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
