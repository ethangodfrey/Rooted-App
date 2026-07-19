import { VendorStripeConnectPanel } from '@/components/payments/VendorStripeConnectPanel';

export const dynamic = 'force-dynamic';

/**
 * Vendor Stripe Connect payment settings —
 * `/vendor/settings/payments?access_token=…&stripe=return|refresh`
 */
export default async function VendorPaymentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const accessToken =
    typeof params.access_token === 'string'
      ? params.access_token
      : typeof params.accessToken === 'string'
        ? params.accessToken
        : null;
  const stripe =
    typeof params.stripe === 'string' ? params.stripe.trim() : null;

  return (
    <main className="min-h-screen bg-[#0B1228]">
      <VendorStripeConnectPanel
        accessToken={accessToken}
        stripeReturn={stripe}
      />
    </main>
  );
}
