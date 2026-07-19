import { WholesaleOutboundOrders } from '@/components/b2b/WholesaleOutboundOrders';

export const dynamic = 'force-dynamic';

/**
 * Buyer wholesale order history — `/vendor/wholesale/history?access_token=…`
 */
export default async function VendorWholesaleHistoryPage({
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

  return (
    <main className="min-h-screen bg-[#0B1228]">
      <WholesaleOutboundOrders accessToken={accessToken} />
    </main>
  );
}
