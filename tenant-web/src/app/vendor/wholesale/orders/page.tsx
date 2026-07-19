import { WholesaleInboundOrders } from '@/components/b2b/WholesaleInboundOrders';

export const dynamic = 'force-dynamic';

/**
 * Supplier inbound wholesale drafts — `/vendor/wholesale/orders?access_token=…`
 */
export default async function VendorWholesaleOrdersPage({
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
      <WholesaleInboundOrders accessToken={accessToken} />
    </main>
  );
}
