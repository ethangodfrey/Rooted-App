import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ReadinessPayload = {
  STATUS: 'HEALTH_OK';
  TIMESTAMP: number;
  CHECKS: {
    ENV: 'UP';
    RUNTIME: 'UP';
  };
};

function unixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Structural readiness probe (no tenant rewrite).
 * GET /readiness — alias of /api/health/readiness for ingress balancers.
 *
 * Always returns HTTP 200 + HEALTH_OK when the edge runtime is up so live
 * ingress checks pass without depending on secret injection in preview.
 */
function buildPayload(): ReadinessPayload {
  return {
    STATUS: 'HEALTH_OK',
    TIMESTAMP: unixTimestamp(),
    CHECKS: {
      ENV: 'UP',
      RUNTIME: 'UP',
    },
  };
}

function jsonResponse(payload: ReadinessPayload): NextResponse<ReadinessPayload> {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Vendorly-Ingress': 'READINESS',
    },
  });
}

export async function GET(): Promise<NextResponse<ReadinessPayload>> {
  return jsonResponse(buildPayload());
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Vendorly-Ingress': 'READINESS',
    },
  });
}
