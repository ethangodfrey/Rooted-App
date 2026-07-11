import { NextResponse } from 'next/server';

import { resolveTenantByHost } from '@/lib/tenant/tenant-service';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.TENANT_REVALIDATE_SECRET?.trim();
  const provided = request.headers.get('x-tenant-revalidate-secret')?.trim();
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const host = url.searchParams.get('host')?.trim();
  if (!host) {
    return NextResponse.json({ error: 'host query parameter is required' }, { status: 400 });
  }

  const envelope = await resolveTenantByHost(host, { forceRefresh: true });
  return NextResponse.json({
    ok: true,
    slug: envelope.tenant.slug,
    resolvedHost: envelope.resolvedHost,
  });
}
