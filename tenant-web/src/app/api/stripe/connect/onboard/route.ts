import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest POST /stripe/connect/onboard */
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  return proxyToNest(request, '/stripe/connect/onboard', {
    method: 'POST',
    body,
  });
}
