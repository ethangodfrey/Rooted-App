import { InventoryManager } from '@/components/InventoryManager';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Vendor inventory management — `/vendor/inventory?vendorId=<uuid>`.
 *
 * Pass the Supabase access token via `access_token` (demos) or embed
 * InventoryManager with `accessToken` from your authenticated shell.
 */
export default async function VendorInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vendorId = typeof params.vendorId === 'string' ? params.vendorId.trim() : '';
  const accessToken =
    typeof params.access_token === 'string'
      ? params.access_token
      : typeof params.accessToken === 'string'
        ? params.accessToken
        : null;

  if (!vendorId) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
          Catalog
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Inventory</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
          Provide <code className="rounded bg-white/10 px-1">?vendorId=…</code> and authorize with a
          Bearer token to manage hybrid stock allocation.
        </p>
      </main>
    );
  }

  if (!UUID_RE.test(vendorId)) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
        <h1 className="text-3xl font-extrabold tracking-tight">Inventory</h1>
        <p className="mt-3 text-sm font-medium text-rose-300">vendorId must be a valid UUID.</p>
      </main>
    );
  }

  const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim() || null;

  return (
    <main className="min-h-screen bg-[#0B1228]">
      <InventoryManager
        vendorId={vendorId}
        accessToken={accessToken}
        marketplaceUrl={marketplaceUrl}
      />
    </main>
  );
}
