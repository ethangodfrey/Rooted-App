import { BusinessConnectionPanel } from '@/components/b2b/BusinessConnectionPanel';
import { WholesaleCatalogMatrix } from '@/components/b2b/WholesaleCatalogMatrix';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Target vendor B2B profile — connection handshake + wholesale catalog.
 * `/vendor/partners/<vendorId>?access_token=…&name=…`
 */
export default async function VendorPartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { vendorId: rawVendorId } = await params;
  const vendorId = rawVendorId.trim();
  const query = await searchParams;
  const accessToken =
    typeof query.access_token === 'string'
      ? query.access_token
      : typeof query.accessToken === 'string'
        ? query.accessToken
        : null;
  const peerName = typeof query.name === 'string' ? query.name.trim() : null;

  if (!UUID_RE.test(vendorId)) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-16 font-sans text-zinc-50">
        <h1 className="text-3xl font-extrabold tracking-tight">Partner Profile</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-rose-300">
          VENDOR_ID_INVALID
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1228]">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <BusinessConnectionPanel
          peerVendorId={vendorId}
          peerVendorName={peerName}
          accessToken={accessToken}
        />
        <div className="min-w-0">
          <WholesaleCatalogMatrix vendorId={vendorId} accessToken={accessToken} />
        </div>
      </div>
    </main>
  );
}
