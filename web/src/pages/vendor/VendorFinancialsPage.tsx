import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { EscrowPayouts } from '@/components/vendor/EscrowPayouts';
import { WalletOverview } from '@/components/vendor/WalletOverview';
import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchVendorBalance,
  fetchVendorTransactions,
  type FinancialTransactionItem,
  type VendorBalance,
} from '@/lib/vendor-financials';
import '@/components/ui/ui.css';

export function VendorFinancialsPage() {
  const { vendor } = useAuth();
  const [balance, setBalance] = useState<VendorBalance | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransactionItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('FINANCIAL_UI_ACTIVE SURFACE=VENDOR_WALLET');
    console.log('INVOICING_DASHBOARD_INITIALIZED SURFACE=VENDOR_FINANCIALS');
  }, []);

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

      <VendorSection title="Wallet Overview">
        <WalletOverview balance={balance} loading={loading} />
      </VendorSection>

      <VendorSection title="Escrow & Payouts">
        <EscrowPayouts items={transactions} loading={loading} />
      </VendorSection>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-white/40">
        INVOICING_DASHBOARD_INITIALIZED · Download invoices from accepted catering
        and wholesale procurement requests.
      </p>
    </VendorScreen>
  );
}
