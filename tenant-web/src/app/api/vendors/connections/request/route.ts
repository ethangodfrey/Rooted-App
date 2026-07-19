import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest POST /api/vendors/connections/request */
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  return proxyToNest(request, '/api/vendors/connections/request', {
    method: 'POST',
    body,
  });
}
