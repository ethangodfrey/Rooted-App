/**
 * @deprecated Import from `@/src/lib/network-connections` — B2B edges are profile-based.
 */
export {
  acceptNetworkConnection as acceptVendorConnection,
  cancelNetworkConnection as cancelVendorConnection,
  fetchLocalNetworkPeers,
  fetchLocalNetworkVendors,
  fetchNetworkConnection as fetchVendorConnection,
  sendNetworkConnectionRequest as sendVendorConnectionRequest,
  toConnectionView,
  type NetworkConnectionRow as VendorConnectionRow,
  type NetworkConnectionStatus as VendorConnectionStatus,
  type NetworkConnectionUi as VendorConnectionUi,
  type NetworkConnectionView as VendorConnectionView,
  type NetworkPeer,
  type NetworkPeer as NetworkVendor,
} from '@/src/lib/network-connections';
