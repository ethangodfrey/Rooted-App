import { NextResponse } from 'next/server';

import { resolveApiBaseUrl } from '@/lib/tenant/resolve-host';

export function extractBearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function proxyToNest(
  request: Request,
  path: string,
  init?: { method?: string; body?: string | null },
): Promise<NextResponse> {
  const token = extractBearer(request);
  if (!token) {
    return NextResponse.json(
      { error: 'Authorization Bearer token is required' },
      { status: 401 },
    );
  }

  const base = resolveApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const method = init?.method ?? request.method;
  const upstream = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : (init?.body ?? null),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text.slice(0, 200) };
    }
  }

  return NextResponse.json(json ?? {}, { status: upstream.status });
}
