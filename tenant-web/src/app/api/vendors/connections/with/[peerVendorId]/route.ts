import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /api/vendors/connections/with/:peerVendorId */
export async function GET(
  request: Request,
  context: { params: Promise<{ peerVendorId: string }> },
): Promise<Response> {
  const { peerVendorId } = await context.params;
  return proxyToNest(
    request,
    `/api/vendors/connections/with/${encodeURIComponent(peerVendorId)}`,
    { method: 'GET' },
  );
}
