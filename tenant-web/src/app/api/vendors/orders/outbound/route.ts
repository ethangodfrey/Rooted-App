import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /api/vendors/orders/outbound */
export async function GET(request: Request): Promise<Response> {
  return proxyToNest(request, '/api/vendors/orders/outbound', { method: 'GET' });
}
