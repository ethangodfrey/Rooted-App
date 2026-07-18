import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  connectPosIntegration,
  disconnectPosIntegration,
  fetchPosIntegrations,
  POS_PROVIDER_CARDS,
  type PosAnalyticsProvider,
  type PosIntegration,
} from '@/lib/pos-analytics';
import { formatDateTime } from '@/lib/format';
import './pos-analytics.css';

export function VendorAnalyticsIntegrationsPage() {
  const { user } = useAuth();
  const vendorId = user?.id ?? null;
  const [rows, setRows] = useState<PosIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PosAnalyticsProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendorId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchPosIntegrations(vendorId);
      setRows(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load POS sync center');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byProvider = useMemo(() => {
    const map = new Map<PosAnalyticsProvider, PosIntegration>();
    for (const row of rows) map.set(row.provider, row);
    return map;
  }, [rows]);

  async function onConnect(provider: PosAnalyticsProvider) {
    if (!vendorId) return;
    setBusy(provider);
    try {
      const updated = await connectPosIntegration(vendorId, provider);
      setRows((prev) => {
        const others = prev.filter((row) => row.provider !== provider);
        return [...others, updated].sort((a, b) => a.provider.localeCompare(b.provider));
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect(provider: PosAnalyticsProvider) {
    if (!vendorId) return;
    setBusy(provider);
    try {
      const updated = await disconnectPosIntegration(vendorId, provider);
      setRows((prev) => {
        const others = prev.filter((row) => row.provider !== provider);
        return [...others, updated].sort((a, b) => a.provider.localeCompare(b.provider));
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pos-sync">
      <div className="pos-sync__nav">
        <Link to="/vendor/analytics" className="pos-sync__btn">
          [ BACK TO ANALYTICS ]
        </Link>
      </div>

      <header className="pos-sync__header">
        <p className="pos-sync__kicker">POS SYNC</p>
        <h1 className="pos-sync__title">External Provider Sync Center</h1>
        <p className="pos-sync__copy">
          Connect Square Reader, Toast POS, and Stripe Connect hardware accounts so external
          transaction volume can roll into the business telemetry suite.
        </p>
      </header>

      {error ? <p className="pos-telemetry__error">{error}</p> : null}

      {loading ? (
        <p className="pos-sync__status">LOADING PROVIDERS</p>
      ) : (
        <div className="pos-sync__grid">
          {POS_PROVIDER_CARDS.map((card) => {
            const row = byProvider.get(card.provider);
            const active = Boolean(row?.credentials_connected);
            const isBusy = busy === card.provider;

            return (
              <article key={card.provider} className="pos-sync__card">
                <h2 className="pos-sync__card-title">{card.title}</h2>
                <p className="pos-sync__card-copy">{card.subtitle}</p>
                <p className="pos-sync__status">
                  {active
                    ? `ACTIVE${row?.last_sync_at ? ` · LAST SYNC ${formatDateTime(row.last_sync_at)}` : ''}`
                    : 'DISCONNECTED'}
                </p>
                <div className="pos-sync__actions">
                  {active ? (
                    <>
                      <span className="pos-sync__btn pos-sync__btn--active" aria-current="true">
                        [ ACTIVE ]
                      </span>
                      <button
                        type="button"
                        className="pos-sync__btn"
                        disabled={isBusy || !vendorId}
                        onClick={() => void onDisconnect(card.provider)}>
                        [ DISCONNECT ]
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="pos-sync__btn"
                      disabled={isBusy || !vendorId}
                      onClick={() => void onConnect(card.provider)}>
                      [ CONNECT ACCOUNT ]
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
