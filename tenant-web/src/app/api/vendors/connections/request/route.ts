import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Legacy alias — prefer POST /api/vendors/connections.
 * Proxies Nest POST /api/vendors/connections/request
 */
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  // eslint-disable-next-line no-console
  console.log('CONNECTION_REQUEST_INITIATED ROUTE=/api/vendors/connections/request');
  const response = await proxyToNest(request, '/api/vendors/connections/request', {
    method: 'POST',
    body,
  });
  if (response.ok) {
    // eslint-disable-next-line no-console
    console.log('PROXY_HANDSHAKE_SUCCESS UPSTREAM=/api/vendors/connections/request');
  }
  return response;
}
