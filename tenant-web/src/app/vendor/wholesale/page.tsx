import { WholesaleCatalogMatrix } from '@/components/b2b/WholesaleCatalogMatrix';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * B2B wholesale catalog discovery — `/vendor/wholesale?vendorId=<peer>&access_token=…`
 * Omit vendorId to load the authenticated vendor's own catalog.
 */
export default async function VendorWholesalePage({
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

  if (vendorId && !UUID_RE.test(vendorId)) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-16 font-sans text-zinc-50">
        <h1 className="text-3xl font-extrabold tracking-tight">Wholesale Catalog</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-rose-300">
          VENDOR_ID_INVALID
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1228]">
      <WholesaleCatalogMatrix
        vendorId={vendorId || null}
        accessToken={accessToken}
      />
    </main>
  );
}
