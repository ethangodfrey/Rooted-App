import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ReadinessPayload = {
  STATUS: 'HEALTH_OK' | 'HEALTH_DEGRADED';
  TIMESTAMP: number;
  CHECKS: {
    ENV: 'UP' | 'DOWN';
    RUNTIME: 'UP';
  };
};

function unixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

function readSupabaseEnv(): { url: string; anonKey: string } {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, anonKey };
}

/**
 * Edge readiness probe for upstream balancers / live soak.
 * GET /api/health/readiness
 *
 * Must remain outside multi-tenant middleware rewrites (see middleware matcher).
 */
function buildPayload(): { payload: ReadinessPayload; status: number } {
  const { url, anonKey } = readSupabaseEnv();
  const envOk = url.toLowerCase().startsWith('https://') && anonKey.length >= 32;

  const payload: ReadinessPayload = {
    STATUS: envOk ? 'HEALTH_OK' : 'HEALTH_DEGRADED',
    TIMESTAMP: unixTimestamp(),
    CHECKS: {
      ENV: envOk ? 'UP' : 'DOWN',
      RUNTIME: 'UP',
    },
  };

  return { payload, status: envOk ? 200 : 503 };
}

function jsonResponse(payload: ReadinessPayload, status: number): NextResponse<ReadinessPayload> {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Vendorly-Ingress': 'READINESS',
    },
  });
}

export async function GET(): Promise<NextResponse<ReadinessPayload>> {
  const { payload, status } = buildPayload();
  return jsonResponse(payload, status);
}

export async function HEAD(): Promise<NextResponse> {
  const { status } = buildPayload();
  return new NextResponse(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Vendorly-Ingress': 'READINESS',
    },
  });
}
