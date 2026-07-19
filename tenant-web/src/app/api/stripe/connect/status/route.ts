import { proxyToNest } from '@/lib/b2b/nest-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy Nest GET /stripe/connect/status */
export async function GET(request: Request): Promise<Response> {
  return proxyToNest(request, '/stripe/connect/status', { method: 'GET' });
}
