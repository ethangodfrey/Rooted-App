/** CORS headers so the Vite SPA can call OAuth connect with a Bearer token. */

function allowedOrigins(): Set<string> {
  const raw =
    process.env.INTEGRATION_CORS_ORIGINS?.trim() ||
    process.env.WEB_APP_ORIGIN?.trim() ||
    '';
  const listed = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://vendorly.app',
    'https://www.vendorly.app',
    'https://vendorlymarketplace.vercel.app',
  ];
  return new Set([...defaults, ...listed]);
}

export function corsHeadersFor(request: Request): Record<string, string> {
  const origin = (request.headers.get('origin') ?? '').replace(/\/$/, '');
  const allowed = allowedOrigins();
  if (!origin || !allowed.has(origin)) {
    return {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function corsPreflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
}
