import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { StripeBankLinkBanner } from '@/components/payments/StripeBankLinkBanner';
import { EscrowPayouts } from '@/components/vendor/EscrowPayouts';
import { SettlementDashboard } from '@/components/vendor/SettlementDashboard';
import { WalletOverview } from '@/components/vendor/WalletOverview';
import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { useVendorSettlementOrders } from '@/hooks/use-vendor-settlement-orders';
import { isApiConfigured } from '@/lib/api';
import {
  fetchPaymentsOnboardStatus,
  formatBankLinkInitializedLog,
  formatStripeOnboardingActiveLog,
  refreshPaymentsOnboarding,
  startPaymentsOnboarding,
  type PaymentsOnboardStatus,
} from '@/lib/payments-onboarding';
import {
  formatEscrowFrozenActiveLog,
  raiseDispute,
} from '@/lib/disputes';
import {
  fetchVendorBalance,
  fetchVendorTransactions,
  type FinancialTransactionItem,
  type VendorBalance,
} from '@/lib/vendor-financials';
import '@/components/ui/ui.css';

export function VendorFinancialsPage() {
  const { vendor, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const stripeReturn = searchParams.get('stripe');
  const {
    orders: settlementOrders,
    loading: settlementLoading,
    error: settlementError,
  } = useVendorSettlementOrders(vendor?.id);
  const [balance, setBalance] = useState<VendorBalance | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransactionItem[]>(
    [],
  );
  const [onboard, setOnboard] = useState<PaymentsOnboardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardLoading, setOnboardLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('FINANCIAL_UI_ACTIVE SURFACE=VENDOR_WALLET');
    console.log('INVOICING_ENGINE_INITIALIZED SURFACE=VENDOR_FINANCIALS');
    console.log(formatStripeOnboardingActiveLog({ role: 'vendor' }));
  }, []);

  const loadOnboard = useCallback(async () => {
    if (!isApiConfigured) {
      setOnboard({
        STATUS: 'BANK_LINK_REQUIRED',
        ROLE: 'VENDOR',
        ACTOR_ID: vendor?.id ?? '',
        STRIPE_ACCOUNT_ID: vendor?.stripe_account_id ?? null,
        PAYOUTS_ENABLED: Boolean(vendor?.stripe_account_id),
      });
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
      setOnboard({
        STATUS: 'BANK_LINK_REQUIRED',
        ROLE: 'VENDOR',
        ACTOR_ID: vendor?.id ?? '',
        STRIPE_ACCOUNT_ID: vendor?.stripe_account_id ?? null,
        PAYOUTS_ENABLED: Boolean(vendor?.stripe_account_id),
      });
    } finally {
      setOnboardLoading(false);
    }
  }, [vendor?.id, vendor?.stripe_account_id]);

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setLoading(false);
      return;
    }
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [bal, tx] = await Promise.all([
        fetchVendorBalance(vendor.id),
        fetchVendorTransactions(vendor.id, 40),
      ]);
      setBalance(bal);
      setTransactions(tx.ITEMS ?? []);
      console.log(
        `FINANCIAL_UI_ACTIVE AVAILABLE_CENTS=${bal.AVAILABLE_CENTS} TX=${tx.COUNT ?? 0}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load financial dashboard',
      );
    } finally {
      setLoading(false);
    }
  }, [vendor?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOnboard();
  }, [loadOnboard]);

  useEffect(() => {
    if (stripeReturn !== 'return' && stripeReturn !== 'refresh') return;
    void loadOnboard();
    void refreshUser();
    if (stripeReturn === 'refresh' && isApiConfigured) {
      void (async () => {
        try {
          setLinking(true);
          const origin = window.location.origin;
          const result = await refreshPaymentsOnboarding({
            returnUrl: `${origin}/vendor/financials?stripe=return`,
            refreshUrl: `${origin}/vendor/financials?stripe=refresh`,
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
  }, [stripeReturn, loadOnboard, refreshUser]);

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
        returnUrl: `${origin}/vendor/financials?stripe=return`,
        refreshUrl: `${origin}/vendor/financials?stripe=refresh`,
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

  async function handleReportIssue(transactionId: string) {
    const reason = window.prompt(
      'Describe the issue with this escrow hold (catering / delivery):',
      'Delivery or catering issue — please review escrow.',
    );
    if (!reason?.trim()) return;
    setReportingId(transactionId);
    setError(null);
    try {
      const res = await raiseDispute({ transactionId, reason: reason.trim() });
      console.log(
        formatEscrowFrozenActiveLog({
          transactionId: res.TRANSACTION_ID,
          disputeId: res.DISPUTE_ID,
        }),
      );
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
        eyebrow="Phase 4 clearing"
        title="Financials"
        subtitle="Wallet overview from vendor_balances, plus escrow holds and settled payouts from the financial ledger."
        pill="FINANCIAL_UI_ACTIVE"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/vendor/procurement"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Procurement
        </Link>
        <Link
          to="/vendor/availability"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Catering inquiries
        </Link>
        <Link
          to="/vendor/loyalty"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Loyalty & Boosts
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}

      <StripeBankLinkBanner
        surface="VENDOR_FINANCIALS"
        payoutsEnabled={Boolean(onboard?.PAYOUTS_ENABLED)}
        loading={onboardLoading}
        linking={linking}
        onLinkBank={() => void handleLinkBank()}
      />

      <VendorSection title="Wallet Overview">
        <WalletOverview balance={balance} loading={loading} />
      </VendorSection>

      <VendorSection title="Escrow & Payouts">
        <EscrowPayouts
          items={transactions}
          loading={loading}
          reportingId={reportingId}
          onReportIssue={(transactionId) => void handleReportIssue(transactionId)}
        />
      </VendorSection>

      <VendorSection title="Market settlement">
        <SettlementDashboard
          orders={settlementOrders}
          loading={settlementLoading}
          error={settlementError}
        />
      </VendorSection>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-white/40">
        INVOICING_ENGINE_INITIALIZED · Download invoices from accepted catering
        and wholesale procurement requests.
      </p>
    </VendorScreen>
  );
}
