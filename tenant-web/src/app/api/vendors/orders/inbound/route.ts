import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /api/vendors/orders/inbound */
export async function GET(request: Request): Promise<Response> {
  return proxyToNest(request, '/api/vendors/orders/inbound', { method: 'GET' });
}
