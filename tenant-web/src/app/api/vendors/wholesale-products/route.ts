import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET/POST /api/vendors/wholesale-products */
export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const qs = incoming.searchParams.toString();
  const path = `/api/vendors/wholesale-products${qs ? `?${qs}` : ''}`;
  return proxyToNest(request, path, { method: 'GET' });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  return proxyToNest(request, '/api/vendors/wholesale-products', {
    method: 'POST',
    body,
  });
}
