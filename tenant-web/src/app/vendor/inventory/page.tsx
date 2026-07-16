import Link from 'next/link';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Vendor inventory management — `/vendor/inventory?vendorId=<uuid>`.
 *
 * Catalog editing lives in the Vendorly marketplace vendor workspace;
 * this page is the tenant-web deep-link landing for Manage Inventory CTAs.
 */
export default async function VendorInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vendorId = typeof params.vendorId === 'string' ? params.vendorId.trim() : '';

  if (!vendorId) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
          Catalog
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Inventory</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
          Provide <code className="rounded bg-white/10 px-1">?vendorId=…</code> to open inventory
          management for a merchant.
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

  const marketplaceInventoryUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL != null && process.env.NEXT_PUBLIC_MARKETPLACE_URL !== ''
      ? `${process.env.NEXT_PUBLIC_MARKETPLACE_URL.replace(/\/$/, '')}/vendor/inventory?vendorId=${encodeURIComponent(vendorId)}`
      : null;

  return (
    <main className="min-h-screen bg-[#0B1228] font-sans text-zinc-50">
      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
          Catalog
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">Inventory</h1>
        <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/70 md:text-base">
          Manage product listings, stock, and availability for this vendor.
        </p>

        <article className="mt-8 rounded-xl border border-orange-500/30 bg-[#121a36] px-6 py-7">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
            Vendor
          </p>
          <p className="mt-2 font-mono text-sm font-semibold tracking-tight text-white/90 break-all">
            {vendorId}
          </p>
          <p className="mt-4 text-sm font-medium leading-relaxed text-white/65">
            Open the full catalog editor to add products, update prices, and sync availability with
            your market events.
          </p>
          {marketplaceInventoryUrl ? (
            <a
              href={marketplaceInventoryUrl}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98]"
            >
              Edit Products
            </a>
          ) : (
            <Link
              href={`/vendor/analytics?vendorId=${encodeURIComponent(vendorId)}`}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-transparent px-6 py-4 text-sm font-semibold tracking-wide text-orange-400 transition-all duration-200 hover:border-orange-400 hover:text-orange-300 active:scale-[0.98]"
            >
              Back to sales analytics
            </Link>
          )}
        </article>
      </section>
    </main>
  );
}
