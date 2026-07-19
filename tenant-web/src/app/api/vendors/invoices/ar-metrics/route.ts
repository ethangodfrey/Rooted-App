import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /api/vendors/invoices/ar-metrics */
export async function GET(request: Request): Promise<Response> {
  return proxyToNest(request, '/api/vendors/invoices/ar-metrics', {
    method: 'GET',
  });
}
