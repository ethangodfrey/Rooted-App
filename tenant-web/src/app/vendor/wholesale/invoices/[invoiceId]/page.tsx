import { WholesaleInvoiceView } from '@/components/b2b/WholesaleInvoiceView';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Buyer/seller invoice detail — `/vendor/wholesale/invoices/<invoiceId>?access_token=…`
 */
export default async function VendorWholesaleInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { invoiceId: rawId } = await params;
  const invoiceId = rawId.trim();
  const query = await searchParams;
  const accessToken =
    typeof query.access_token === 'string'
      ? query.access_token
      : typeof query.accessToken === 'string'
        ? query.accessToken
        : null;

  if (!UUID_RE.test(invoiceId)) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-16 font-sans text-zinc-50">
        <h1 className="text-3xl font-extrabold tracking-tight">Wholesale Invoice</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-rose-300">
          INVOICE_ID_INVALID
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1228] print:bg-white">
      <WholesaleInvoiceView invoiceId={invoiceId} accessToken={accessToken} />
    </main>
  );
}
