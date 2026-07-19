import { SupplierARCommandCenter } from '@/components/b2b/SupplierARCommandCenter';

export const dynamic = 'force-dynamic';

/**
 * Supplier A/R command center — `/vendor/wholesale/dashboard?access_token=…`
 */
export default async function VendorWholesaleDashboardPage({
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
      <SupplierARCommandCenter accessToken={accessToken} />
    </main>
  );
}
