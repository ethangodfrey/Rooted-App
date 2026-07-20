import { NextResponse } from 'next/server';

import { extractBearer, proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Same-origin B2B connections ingress.
 * POST /api/vendors/connections → Nest POST /api/vendors/connections/request
 * GET  /api/vendors/connections → Nest GET  /api/vendors/connections
 */
export async function GET(request: Request): Promise<Response> {
  return proxyToNest(request, '/api/vendors/connections', { method: 'GET' });
}

export async function POST(request: Request): Promise<Response> {
  const token = extractBearer(request);
  if (!token) {
    // eslint-disable-next-line no-console
    console.log('PROXY_HANDSHAKE_FAILED REASON=MISSING_BEARER');
    return NextResponse.json(
      { error: 'Authorization Bearer token is required' },
      { status: 401 },
    );
  }

  const body = await request.text();
  // eslint-disable-next-line no-console
  console.log('CONNECTION_REQUEST_INITIATED ROUTE=/api/vendors/connections');

  const response = await proxyToNest(request, '/api/vendors/connections/request', {
    method: 'POST',
    body,
  });

  if (response.ok) {
    // eslint-disable-next-line no-console
    console.log('PROXY_HANDSHAKE_SUCCESS UPSTREAM=/api/vendors/connections/request');
  } else {
    // eslint-disable-next-line no-console
    console.log(`PROXY_HANDSHAKE_FAILED STATUS=${response.status}`);
  }

  return response;
}
