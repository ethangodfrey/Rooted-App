import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  VendorActionGrid,
  VendorEmpty,
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorListRow,
  VendorPrimaryButton,
  VendorScreen,
  VendorSecondaryButton,
  VendorSection,
  VendorStatusPill,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { BACKEND_UNAVAILABLE_COPY } from '@/lib/api-url';
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

      // Do NOT auto-open developer.squareup.com here. On mobile Safari,
      // window.open steals the tab and users never reach the OAuth consent page.
      // Sandbox sellers can use the explicit "Open Square Developer" button first.
      if (oauthEnvironment === 'sandbox') {
        const host = (() => {
          try {
            return new URL(authorizeUrl).hostname;
          } catch {
            return '';
          }
        })();
        if (host && host !== 'connect.squareupsandbox.com') {
          setError(
            `Sandbox OAuth must use connect.squareupsandbox.com (got ${host}). Check SQUARE_ENVIRONMENT on Railway.`,
          );
          return;
        }
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
      <VendorScreen>
        <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
        <VendorHero eyebrow="Vendor" title="Point of Sale" />
        <VendorFormPanel>
          <p className="m-0 text-sm font-semibold text-stone-800">Square POS sync unavailable</p>
          <p className="m-0 mt-1 text-xs text-stone-500">{BACKEND_UNAVAILABLE_COPY}</p>
        </VendorFormPanel>
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
      <VendorHero eyebrow="Vendor" title="Point of Sale" subtitle="Import Square sales into analytics" />

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : (
        <>
          {connections.length === 0 ? (
            <VendorEmpty message="No POS connected yet." />
          ) : (
            <VendorSection title="Connections">
              <VendorListPanel>
                {connections.map((c) => (
                  <Link
                    key={c.id}
                    to={`/vendor/pos/${c.id}`}
                    className={`flex items-center justify-between gap-3 p-3.5 no-underline active:bg-stone-100/80 ${VENDOR_PRESSABLE}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-stone-800">
                        {PROVIDER_LABEL[c.provider] ?? c.provider}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        Auto-sync every {c.syncFrequencyMinutes} min
                        {c.lastSyncedAt
                          ? ` · last synced ${formatDateTime(c.lastSyncedAt)}`
                          : ' · not synced yet'}
                      </span>
                    </span>
                    <VendorStatusPill label={STATUS_LABEL[c.status] ?? c.status} />
                  </Link>
                ))}
              </VendorListPanel>
            </VendorSection>
          )}

          {oauthRedirectUri ? (
            <VendorFormPanel className="mb-5">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">OAuth redirect URL</p>
              <p className="m-0 mt-1 break-all text-xs text-stone-600">{oauthRedirectUri}</p>
            </VendorFormPanel>
          ) : null}

          {!squareActive ? (
            <VendorFormPanel className="mb-5">
              <p className="m-0 text-sm font-semibold text-stone-800">Connect Square</p>
              <p className="m-0 mt-1 text-xs text-stone-500">
                For sandbox, open your Square Developer test account first.
              </p>
              <VendorActionGrid>
                <VendorSecondaryButton className="w-full" onClick={openSquareSandboxSetup}>
                  Open Square Developer
                </VendorSecondaryButton>
                <VendorPrimaryButton className="w-full" disabled={connecting} onClick={() => void connectSquare()}>
                  {connecting ? 'Connecting…' : 'Connect Square'}
                </VendorPrimaryButton>
              </VendorActionGrid>
            </VendorFormPanel>
          ) : (
            <VendorSection title="Tools">
              <VendorListPanel>
                <VendorListRow
                  to="/vendor/pos/activity"
                  title="Live activity"
                  subtitle="Syncs, alerts, queue health"
                  icon="trending-up"
                  tone="amber"
                />
                <VendorListRow
                  to="/vendor/pos/mappings"
                  title="Item mappings"
                  subtitle="Map register items to products"
                  icon="link"
                  tone="stone"
                />
              </VendorListPanel>
            </VendorSection>
          )}

          {error ? <p className="app-error">{error}</p> : null}
        </>
      )}
    </VendorScreen>
  );
}
