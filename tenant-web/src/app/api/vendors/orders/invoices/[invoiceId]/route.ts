import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Proxy Nest GET /api/vendors/orders/invoices/:invoiceId */
export async function GET(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
): Promise<Response> {
  const { invoiceId } = await context.params;
  if (!UUID_RE.test(invoiceId.trim())) {
    return Response.json(
      { error: 'WHOLESALE_INVOICE_VALIDATION_ERROR: INVOICE_ID INVALID' },
      { status: 400 },
    );
  }
  return proxyToNest(
    request,
    `/api/vendors/orders/invoices/${encodeURIComponent(invoiceId.trim())}`,
    { method: 'GET' },
  );
}
