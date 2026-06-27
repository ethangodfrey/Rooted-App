import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { posApi } from '@/lib/pos-api';
import { getPosOAuthReturnUrl } from '@/lib/pos-oauth-return';
import { triggerStalePosSync } from '@/lib/pos-sync';
import { openSquareOAuth, openSquareSandboxSetup } from '@/lib/square-oauth';
import type { PosConnection } from '@/types/pos';
import '@/components/ui/ui.css';

const PROVIDER_LABEL: Record<string, string> = {
  SQUARE: 'Square',
  TOAST: 'Toast',
  CLOVER: 'Clover',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  ERROR: 'Error',
  EXPIRED: 'Expired',
  DISCONNECTED: 'Disconnected',
};

export function VendorPosPage() {
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | null>(null);

  const squareActive = connections.some((c) => c.provider === 'SQUARE' && c.status === 'ACTIVE');

  const load = useCallback(async () => {
    if (!isApiConfigured || !vendor) {
      setLoading(false);
      return;
    }
    try {
      const data = await posApi.listConnections();
      setConnections(data);
      setError(null);
      void triggerStalePosSync();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vendor]);

  useEffect(() => {
    void load();
    if (!isApiConfigured) return;
    void posApi
      .getOAuthRedirectUri('SQUARE')
      .then((info) => setOauthRedirectUri(info.redirectUri))
      .catch(() => setOauthRedirectUri(null));
  }, [load]);

  async function connectSquare() {
    setConnecting(true);
    setError(null);
    try {
      const returnUrl = getPosOAuthReturnUrl();
      const { authorizeUrl, oauthEnvironment, connection } = await posApi.createConnection(
        'SQUARE',
        returnUrl,
      );

      if (connection.status === 'ACTIVE') {
        navigate('/vendor/pos/connected?status=success');
        return;
      }

      if (!authorizeUrl) {
        setError('Square did not return an authorization URL.');
        return;
      }

      if (oauthEnvironment === 'sandbox') {
        openSquareSandboxSetup();
      }

      openSquareOAuth(authorizeUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  if (!isApiConfigured) {
    return (
      <div className="app-screen">
        <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
        <h1 className="app-title">Point of Sale</h1>
        <div className="app-empty">Set VITE_API_URL to connect Square.</div>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">Point of Sale</h1>
      <p className="app-subtitle">Import card sales from Square into analytics.</p>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : (
        <>
          {connections.length === 0 ? (
            <div className="app-card" style={{ marginBottom: '1rem' }}>
              <p className="app-row-meta">No POS connected yet.</p>
            </div>
          ) : (
            <div className="app-list" style={{ marginBottom: '1rem' }}>
              {connections.map((c) => (
                <Link key={c.id} to={`/vendor/pos/${c.id}`} className="app-card app-card--pressable app-row">
                  <div className="app-row-body">
                    <p className="app-row-title">{PROVIDER_LABEL[c.provider] ?? c.provider}</p>
                    <p className="app-row-meta">
                      Auto-sync every {c.syncFrequencyMinutes} min
                      {c.lastSyncedAt ? ` · last synced ${formatDateTime(c.lastSyncedAt)}` : ' · not synced yet'}
                    </p>
                  </div>
                  <span className="app-status">{STATUS_LABEL[c.status] ?? c.status}</span>
                </Link>
              ))}
            </div>
          )}

          {oauthRedirectUri ? (
            <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
              <p className="app-row-title">Square OAuth redirect URL</p>
              <p className="app-row-meta" style={{ wordBreak: 'break-all' }}>{oauthRedirectUri}</p>
            </div>
          ) : null}

          {!squareActive ? (
            <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
              <p className="app-row-title">Connect Square</p>
              <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
                For sandbox, open your Square Developer test account in another tab first, then connect.
              </p>
              <button type="button" className="app-btn app-btn--secondary" style={{ marginBottom: '0.5rem' }} onClick={openSquareSandboxSetup}>
                Open Square Developer
              </button>
              <button type="button" className="app-btn app-btn--primary" disabled={connecting} onClick={() => void connectSquare()}>
                {connecting ? 'Connecting…' : 'Connect Square'}
              </button>
            </div>
          ) : (
            <Link to="/vendor/pos/mappings" className="app-card app-card--pressable" style={{ display: 'block' }}>
              <p className="app-row-title">Item mappings</p>
              <p className="app-row-meta">Map register items to Vendorly products</p>
            </Link>
          )}

          {error ? <p className="app-error">{error}</p> : null}
        </>
      )}
    </div>
  );
}
