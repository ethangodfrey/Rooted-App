import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /api/vendors/wholesale-products/search?q= */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const path = `/api/vendors/wholesale-products/search${qs ? `?${qs}` : ''}`;
  return proxyToNest(request, path, { method: 'GET' });
}
