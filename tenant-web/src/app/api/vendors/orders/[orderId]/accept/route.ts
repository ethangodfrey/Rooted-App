import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Proxy Nest POST /api/vendors/orders/:orderId/accept */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await context.params;
  if (!UUID_RE.test(orderId.trim())) {
    return Response.json(
      { error: 'WHOLESALE_ORDER_VALIDATION_ERROR: ORDER_ID INVALID' },
      { status: 400 },
    );
  }
  return proxyToNest(
    request,
    `/api/vendors/orders/${encodeURIComponent(orderId.trim())}/accept`,
    { method: 'POST', body: '{}' },
  );
}
