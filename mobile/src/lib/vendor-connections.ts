import { supabase } from '@/src/lib/supabase';
import type { Product } from '@/src/types/database';

/** DB status — `none` means follow-only (no connection request). */
export type VendorConnectionStatus = 'none' | 'pending' | 'connected' | 'ignored';

export interface VendorConnectionRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: VendorConnectionStatus;
  is_following: boolean;
  receiver_is_following: boolean;
  created_at: string;
  updated_at: string;
}

/** Client-facing relationship between the signed-in vendor and a peer. */
export type ConnectionUiState =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'connected'
  | 'ignored';

export interface VendorConnectionView {
  row: VendorConnectionRow | null;
  uiState: ConnectionUiState;
  /** Whether the current vendor follows the peer. */
  isFollowing: boolean;
  /** True when wholesale (`connected_vendors`) products should unlock. */
  canViewWholesale: boolean;
}

function emptyView(): VendorConnectionView {
  return {
    row: null,
    uiState: 'none',
    isFollowing: false,
    canViewWholesale: false,
  };
}

export function toConnectionView(
  row: VendorConnectionRow | null,
  currentVendorId: string,
): VendorConnectionView {
  if (!row) return emptyView();

  const isSender = row.sender_id === currentVendorId;
  const isFollowing = isSender ? row.is_following : row.receiver_is_following;

  let uiState: ConnectionUiState = 'none';
  if (row.status === 'connected') uiState = 'connected';
  else if (row.status === 'ignored') uiState = 'ignored';
  else if (row.status === 'pending') {
    uiState = isSender ? 'pending_sent' : 'pending_received';
  }

  return {
    row,
    uiState,
    isFollowing,
    canViewWholesale: row.status === 'connected',
  };
}

/** 1. Fetch connection status between two vendors (unordered pair). */
export async function fetchVendorConnection(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  if (!currentVendorId || !peerVendorId || currentVendorId === peerVendorId) {
    return emptyView();
  }

  const { data, error } = await supabase
    .from('vendor_connections')
    .select('*')
    .or(
      `and(sender_id.eq.${currentVendorId},receiver_id.eq.${peerVendorId}),and(sender_id.eq.${peerVendorId},receiver_id.eq.${currentVendorId})`,
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toConnectionView((data as VendorConnectionRow | null) ?? null, currentVendorId);
}

/** 2a. Send a connection request (pending). */
export async function sendConnectionRequest(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  if (currentVendorId === peerVendorId) {
    throw new Error('Cannot connect with yourself');
  }

  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);

  if (existing.row) {
    if (existing.row.status === 'connected' || existing.row.status === 'pending') {
      return existing;
    }

    // Upgrade follow-only / ignored shell into an outbound request.
    const wasSender = existing.row.sender_id === currentVendorId;
    const is_following = wasSender
      ? existing.row.is_following
      : existing.row.receiver_is_following;
    const receiver_is_following = wasSender
      ? existing.row.receiver_is_following
      : existing.row.is_following;

    const { data, error } = await supabase
      .from('vendor_connections')
      .update({
        status: 'pending',
        sender_id: currentVendorId,
        receiver_id: peerVendorId,
        is_following,
        receiver_is_following,
      })
      .eq('id', existing.row.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return toConnectionView(data as VendorConnectionRow, currentVendorId);
  }

  const { data, error } = await supabase
    .from('vendor_connections')
    .insert({
      sender_id: currentVendorId,
      receiver_id: peerVendorId,
      status: 'pending',
      is_following: false,
      receiver_is_following: false,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as VendorConnectionRow, currentVendorId);
}

/** 2b. Toggle follow for the current vendor toward the peer. */
export async function toggleFollowVendor(
  currentVendorId: string,
  peerVendorId: string,
  follow: boolean,
): Promise<VendorConnectionView> {
  if (currentVendorId === peerVendorId) {
    throw new Error('Cannot follow yourself');
  }

  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);

  if (!existing.row) {
    if (!follow) return emptyView();
    const { data, error } = await supabase
      .from('vendor_connections')
      .insert({
        sender_id: currentVendorId,
        receiver_id: peerVendorId,
        status: 'none',
        is_following: true,
        receiver_is_following: false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return toConnectionView(data as VendorConnectionRow, currentVendorId);
  }

  const isSender = existing.row.sender_id === currentVendorId;
  const patch = isSender ? { is_following: follow } : { receiver_is_following: follow };

  const { data, error } = await supabase
    .from('vendor_connections')
    .update(patch)
    .eq('id', existing.row.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as VendorConnectionRow, currentVendorId);
}

/** 3a. Accept a pending request (must be the receiver). */
export async function acceptConnectionRequest(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);
  if (!existing.row) throw new Error('No connection request found');
  if (existing.row.receiver_id !== currentVendorId) {
    throw new Error('Only the receiver can accept this request');
  }
  if (existing.row.status !== 'pending') {
    throw new Error('Request is not pending');
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

/** 3b. Decline / ignore a pending request (receiver). */
export async function declineConnectionRequest(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);
  if (!existing.row) throw new Error('No connection request found');
  if (existing.row.receiver_id !== currentVendorId) {
    throw new Error('Only the receiver can ignore this request');
  }

  const { data, error } = await supabase
    .from('vendor_connections')
    .update({ status: 'ignored' })
    .eq('id', existing.row.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toConnectionView(data as VendorConnectionRow, currentVendorId);
}

/** Cancel an outbound pending request (sender deletes the row when not following). */
export async function cancelConnectionRequest(
  currentVendorId: string,
  peerVendorId: string,
): Promise<VendorConnectionView> {
  const existing = await fetchVendorConnection(currentVendorId, peerVendorId);
  if (!existing.row) return emptyView();
  if (existing.row.sender_id !== currentVendorId || existing.row.status !== 'pending') {
    return existing;
  }

  if (existing.isFollowing || existing.row.receiver_is_following) {
    const { data, error } = await supabase
      .from('vendor_connections')
      .update({ status: 'none' })
      .eq('id', existing.row.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return toConnectionView(data as VendorConnectionRow, currentVendorId);
  }

  const { error } = await supabase.from('vendor_connections').delete().eq('id', existing.row.id);
  if (error) throw new Error(error.message);
  return emptyView();
}

/**
 * 4. Fetch a vendor's products — RLS automatically includes/excludes
 * `connected_vendors` wholesale SKUs based on connection status.
 */
export async function fetchVendorProducts(vendorId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Product[]) ?? [];
}

/** Convenience: wholesale-only SKUs visible under RLS when connected. */
export async function fetchVendorWholesaleProducts(vendorId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('status', 'active')
    .eq('visibility', 'connected_vendors')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Product[]) ?? [];
}
