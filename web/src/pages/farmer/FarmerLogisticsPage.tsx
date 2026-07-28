import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ActiveRoutes } from '@/components/farmer/ActiveRoutes';
import { RoutePlanner } from '@/components/farmer/RoutePlanner';
import { StripeBankLinkBanner } from '@/components/payments/StripeBankLinkBanner';
import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import type { ProcurementRequestItem } from '@/lib/b2b-procurement';
import {
  confirmDeliveryDropoff,
  createDeliveryRoute,
  fetchAcceptedProcurementForDispatch,
  fetchMyDeliveryRoutes,
  formatUsdFromCents,
  type DeliveryRouteItem,
} from '@/lib/farmer-logistics';
import {
  formatEscrowFrozenActiveLog,
  raiseDispute,
} from '@/lib/disputes';
import {
  fetchPaymentsOnboardStatus,
  formatBankLinkInitializedLog,
  formatStripeOnboardingActiveLog,
  refreshPaymentsOnboarding,
  startPaymentsOnboarding,
  type PaymentsOnboardStatus,
} from '@/lib/payments-onboarding';
import '@/components/ui/ui.css';

export function FarmerLogisticsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const stripeReturn = searchParams.get('stripe');
  const [accepted, setAccepted] = useState<ProcurementRequestItem[]>([]);
  const [routes, setRoutes] = useState<DeliveryRouteItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dispatchDate, setDispatchDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [onboard, setOnboard] = useState<PaymentsOnboardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardLoading, setOnboardLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [confirmingStopId, setConfirmingStopId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    console.log('FLEET_UI_ACTIVE SURFACE=FARMER_DISPATCH');
    console.log('ROUTE_DISPATCH_INITIALIZED SURFACE=FARMER_LOGISTICS');
    console.log(formatStripeOnboardingActiveLog({ role: 'farmer' }));
  }, []);

  const loadOnboard = useCallback(async () => {
    if (!isApiConfigured) {
      setOnboardLoading(false);
      return;
    }
    setOnboardLoading(true);
    try {
      const status = await fetchPaymentsOnboardStatus();
      setOnboard(status);
      console.log(
        formatStripeOnboardingActiveLog({
          role: status.ROLE,
          accountId: status.STRIPE_ACCOUNT_ID,
        }),
      );
    } catch {
      setOnboard(null);
    } finally {
      setOnboardLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoading(false);
      return;
    }
    if (user?.role && user.role !== 'farmer' && user.role !== 'admin') {
      setError('Fleet dispatch is available for farmer accounts.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [acceptedOrders, routeRes] = await Promise.all([
        fetchAcceptedProcurementForDispatch(),
        fetchMyDeliveryRoutes(30),
      ]);
      setAccepted(acceptedOrders);
      setRoutes(routeRes.ITEMS ?? []);
      setSelectedIds((prev) =>
        prev.filter((id) => acceptedOrders.some((row) => row.id === id)),
      );
      console.log(
        `FLEET_UI_ACTIVE ACCEPTED=${acceptedOrders.length} ROUTES=${routeRes.COUNT ?? 0}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load fleet dashboard',
      );
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOnboard();
  }, [loadOnboard]);

  useEffect(() => {
    if (stripeReturn !== 'return' && stripeReturn !== 'refresh') return;
    void loadOnboard();
    if (stripeReturn === 'refresh' && isApiConfigured) {
      void (async () => {
        try {
          setLinking(true);
          const origin = window.location.origin;
          const result = await refreshPaymentsOnboarding({
            returnUrl: `${origin}/farmer/logistics?stripe=return`,
            refreshUrl: `${origin}/farmer/logistics?stripe=refresh`,
          });
          console.log(
            formatBankLinkInitializedLog({
              action: 'REFRESH',
              role: result.ROLE,
            }),
          );
          window.location.assign(result.URL || result.url || '');
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to refresh Stripe onboarding',
          );
          setLinking(false);
        }
      })();
    }
  }, [stripeReturn, loadOnboard]);

  function onToggle(requestId: string) {
    setSelectedIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId],
    );
  }

  async function handleLinkBank() {
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      return;
    }
    setLinking(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const result = await startPaymentsOnboarding({
        returnUrl: `${origin}/farmer/logistics?stripe=return`,
        refreshUrl: `${origin}/farmer/logistics?stripe=refresh`,
      });
      console.log(
        formatBankLinkInitializedLog({
          action: 'ONBOARD',
          role: result.ROLE,
        }),
      );
      window.location.assign(result.URL || result.url || '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to start bank linking',
      );
      setLinking(false);
    }
  }

  async function onCreateRoute() {
    if (selectedIds.length === 0) return;
    setDispatching(true);
    setError(null);
    setToast(null);
    try {
      const res = await createDeliveryRoute({
        procurementRequestIds: selectedIds,
        dispatchDate,
      });
      setToast(
        `ROUTE_DISPATCH_INITIALIZED ROUTE=${res.ROUTE_ID.slice(0, 8)} STOPS=${res.COUNT}`,
      );
      console.log(
        `ROUTE_DISPATCH_INITIALIZED ROUTE=${res.ROUTE_ID} STOPS=${res.COUNT}`,
      );
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route create failed');
    } finally {
      setDispatching(false);
    }
  }

  async function onConfirmDropoff(stopId: string) {
    setConfirmingStopId(stopId);
    setError(null);
    setToast(null);
    try {
      const res = await confirmDeliveryDropoff(stopId);
      const net = res.SETTLEMENT?.NET_AMOUNT_CENTS;
      setToast(
        `DROPOFF CONFIRMED · FUNDS TRANSFERRED TO AVAILABLE BALANCE${
          net != null ? ` (${formatUsdFromCents(net)})` : ''
        }`,
      );
      console.log(
        `FLEET_UI_ACTIVE ACTION=DROPOFF_CONFIRMED STOP=${stopId.slice(0, 8)} NET=${net ?? 0}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm dropoff failed');
    } finally {
      setConfirmingStopId(null);
    }
  }

  async function onReportIssue(escrowTransactionId: string) {
    const reason = window.prompt(
      'Describe the delivery issue (this freezes escrow until admin review):',
      'Delivery dispute — please freeze escrow.',
    );
    if (!reason?.trim()) return;
    setReportingId(escrowTransactionId);
    setError(null);
    try {
      const res = await raiseDispute({
        transactionId: escrowTransactionId,
        reason: reason.trim(),
      });
      console.log(
        formatEscrowFrozenActiveLog({
          transactionId: res.TRANSACTION_ID,
          disputeId: res.DISPUTE_ID,
        }),
      );
      setToast(`ESCROW_FROZEN_ACTIVE DISPUTE=${res.DISPUTE_ID.slice(0, 8)}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to raise dispute');
    } finally {
      setReportingId(null);
    }
  }

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Farmer shell"
        title="Fleet Dispatch"
        subtitle="Group ACCEPTED wholesale orders into a delivery route, then confirm each dropoff to settle escrow into your available balance."
        pill="FLEET_UI_ACTIVE"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/farmer/network" className="app-btn app-btn--primary app-btn--small">
          V2V Network
        </Link>
        <Link to="/farmer/procurement" className="app-btn app-btn--secondary app-btn--small">
          Procurement
        </Link>
        <Link to="/vendor/inbox" className="app-btn app-btn--ghost app-btn--small">
          Inbox
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/vendor/procurement"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Procurement
        </Link>
        <Link
          to="/vendor/network"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Network
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}
      {toast ? (
        <p
          className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 font-mono text-xs uppercase tracking-wide text-emerald-300"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      <StripeBankLinkBanner
        surface="FARMER_LOGISTICS"
        payoutsEnabled={Boolean(onboard?.PAYOUTS_ENABLED)}
        loading={onboardLoading}
        linking={linking}
        onLinkBank={() => void handleLinkBank()}
      />

      <VendorSection title="Route Planner">
        <RoutePlanner
          accepted={accepted}
          selectedIds={selectedIds}
          dispatchDate={dispatchDate}
          loading={loading}
          dispatching={dispatching}
          onToggle={onToggle}
          onDispatchDateChange={setDispatchDate}
          onCreateRoute={() => void onCreateRoute()}
        />
      </VendorSection>

      <VendorSection title="Active Routes">
        <ActiveRoutes
          routes={routes}
          loading={loading}
          confirmingStopId={confirmingStopId}
          reportingId={reportingId}
          onConfirmDropoff={(stopId) => void onConfirmDropoff(stopId)}
          onReportIssue={(txId) => void onReportIssue(txId)}
        />
      </VendorSection>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-white/40">
        ROUTE_DISPATCH_INITIALIZED · Confirm Dropoff settles wholesale escrow via
        PaymentClearingService.
      </p>
    </VendorScreen>
  );
}
