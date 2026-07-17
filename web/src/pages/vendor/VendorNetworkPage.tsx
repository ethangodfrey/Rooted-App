import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  acceptVendorConnection,
  fetchLocalNetworkVendors,
  fetchVendorConnection,
  sendVendorConnectionRequest,
  type NetworkVendor,
  type VendorConnectionUi,
} from '@/lib/vendor-connections';
import '@/components/ui/ui.css';

type PeerState = Record<string, VendorConnectionUi>;

export function VendorNetworkPage() {
  const { vendor } = useAuth();
  const [vendors, setVendors] = useState<NetworkVendor[]>([]);
  const [states, setStates] = useState<PeerState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!vendor?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const rows = await fetchLocalNetworkVendors({
          currentVendorId: vendor.id,
          postalCode: vendor.postal_code,
        });
        if (!active) return;
        setVendors(rows);

        const entries = await Promise.all(
          rows.map(async (row) => {
            const view = await fetchVendorConnection(vendor.id, row.id);
            return [row.id, view.uiState] as const;
          }),
        );
        if (!active) return;
        setStates(Object.fromEntries(entries));
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load network');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [vendor?.id, vendor?.postal_code]);

  async function connect(peerId: string) {
    if (!vendor?.id) return;
    setBusyId(peerId);
    try {
      const view = await sendVendorConnectionRequest(vendor.id, peerId);
      setStates((prev) => ({ ...prev, [peerId]: view.uiState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send request');
    } finally {
      setBusyId(null);
    }
  }

  async function accept(peerId: string) {
    if (!vendor?.id) return;
    setBusyId(peerId);
    try {
      const view = await acceptVendorConnection(vendor.id, peerId);
      setStates((prev) => ({ ...prev, [peerId]: view.uiState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Vendor Network</h1>
      <p className="app-subtitle">
        Local makers near {vendor?.postal_code?.trim() || 'your area'} — connect for sourcing and
        collaboration.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendor/map" className="app-btn app-btn--primary app-btn--small">
          Markets map
        </Link>
        <Link to="/explore/feed" className="app-btn app-btn--secondary app-btn--small">
          Shop the Explore feed
        </Link>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : vendors.length === 0 ? (
        <div className="app-empty">No nearby approved vendors found yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {vendors.map((peer) => {
            const ui = states[peer.id] ?? 'none';
            const place = [peer.sell_city, peer.sell_state, peer.postal_code]
              .filter(Boolean)
              .join(', ');
            return (
              <li key={peer.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/vendors/${peer.id}`}
                      className="app-row-title"
                      style={{ textDecoration: 'none' }}
                    >
                      {peer.business_name ?? 'Vendor'}
                    </Link>
                    <p className="app-row-meta">
                      {[peer.category, place].filter(Boolean).join(' · ') ||
                        peer.product_summary ||
                        'Local vendor'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {ui === 'none' ? (
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={busyId === peer.id}
                        onClick={() => void connect(peer.id)}
                      >
                        {busyId === peer.id ? 'Sending…' : 'Send Connection Request'}
                      </button>
                    ) : null}
                    {ui === 'pending_sent' ? (
                      <span className="app-btn app-btn--ghost app-btn--small" aria-disabled>
                        Requested
                      </span>
                    ) : null}
                    {ui === 'pending_received' ? (
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={busyId === peer.id}
                        onClick={() => void accept(peer.id)}
                      >
                        Accept
                      </button>
                    ) : null}
                    {ui === 'connected' ? (
                      <span className="app-btn app-btn--secondary app-btn--small" aria-disabled>
                        Connected ✓
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
