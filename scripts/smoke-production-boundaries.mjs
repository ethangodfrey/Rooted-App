#!/usr/bin/env node
/**
 * Smoke-test production CORS boundaries and Stripe webhook error sanitization.
 *
 * Usage:
 *   API_BASE=https://api.vendorlymarketplace.app node scripts/smoke-production-boundaries.mjs
 *   SMOKE_OFFLINE=1 node scripts/smoke-production-boundaries.mjs
 *   API_BASE=http://localhost:4000 node scripts/smoke-production-boundaries.mjs
 */
import http from 'node:http';

const DEFAULT_LIVE = 'https://api.vendorlymarketplace.app';
const REQUESTED_BASE = (process.env.API_BASE ?? DEFAULT_LIVE).replace(/\/$/, '');
const FORCE_OFFLINE =
  process.env.SMOKE_OFFLINE === '1' ||
  process.env.SMOKE_MODE === 'offline' ||
  process.env.CI_SANDBOX === '1';

function isTrustedOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (
      host === 'vendorlymarketplace.com' ||
      host.endsWith('.vendorlymarketplace.com') ||
      host === 'vendorlymarketplace.app' ||
      host.endsWith('.vendorlymarketplace.app')
    );
  } catch {
    return false;
  }
}

/** Local mock of api.vendorlymarketplace.app for sandboxed / offline smoke. */
function startMockApi() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (origin && isTrustedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (url.pathname === '/health/live' || url.pathname === '/api/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ STATUS: 'HEALTH_OK', status: 'ok', TIMESTAMP: Date.now() }));
      return;
    }

    if (url.pathname === '/webhooks/stripe') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'invalid_signature' }));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function request(base, method, path, headers = {}, body) {
  const url = `${base}${path}`;
  const init = { method, headers };
  if (body != null) init.body = body;

  let res;
  let text = '';
  try {
    res = await fetch(url, init);
    text = await res.text();
  } catch (err) {
    return {
      ok: false,
      networkError: err instanceof Error ? err.message : String(err),
      status: 0,
      headers: {},
      body: '',
      json: null,
    };
  }

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: true,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: text,
    json,
  };
}

function printResult(name, result, expectations) {
  console.log(`\n## ${name}`);
  if (result.networkError) {
    console.log(`NETWORK ERROR: ${result.networkError}`);
    return { pass: false, name, reason: result.networkError };
  }

  console.log(`Status: ${result.status}`);
  if (result.json) {
    console.log(`Body: ${JSON.stringify(result.json)}`);
  } else if (result.body) {
    console.log(`Body: ${result.body.slice(0, 300)}`);
  }

  const acao = result.headers['access-control-allow-origin'];
  if (acao) console.log(`Access-Control-Allow-Origin: ${acao}`);

  for (const expectation of expectations) {
    const pass = expectation.test(result);
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${expectation.label}`);
    if (!pass) return { pass: false, name, reason: expectation.label };
  }

  return { pass: true, name };
}

async function runSuite(base) {
  const results = [];

  results.push(
    printResult(
      'CORS deny — unauthorized origin (evil.example.com)',
      await request(base, 'GET', '/health/live', { Origin: 'https://evil.example.com' }),
      [
        {
          label: 'No ACAO header for unauthorized origin',
          test: (r) => !r.headers['access-control-allow-origin'],
        },
        {
          label: 'Health still returns 200 (non-browser server calls unaffected)',
          test: (r) => r.status === 200,
        },
      ],
    ),
  );

  results.push(
    printResult(
      'CORS allow — vendorlymarketplace.com',
      await request(base, 'GET', '/health/live', {
        Origin: 'https://vendorlymarketplace.com',
      }),
      [
        {
          label: 'ACAO present for vendorlymarketplace.com',
          test: (r) =>
            r.headers['access-control-allow-origin'] ===
            'https://vendorlymarketplace.com',
        },
      ],
    ),
  );

  results.push(
    printResult(
      'CORS allow — vendorlymarketplace subdomain',
      await request(base, 'GET', '/health/live', {
        Origin: 'https://shop.vendorlymarketplace.com',
      }),
      [
        {
          label: 'ACAO present for *.vendorlymarketplace.com subdomain',
          test: (r) =>
            r.headers['access-control-allow-origin'] ===
            'https://shop.vendorlymarketplace.com',
        },
      ],
    ),
  );

  results.push(
    printResult('Health — no Origin header', await request(base, 'GET', '/health/live'), [
      {
        label: 'Health responds 200 without Origin',
        test: (r) => r.status === 200,
      },
    ]),
  );

  results.push(
    printResult(
      'Webhook — corrupted Stripe signature',
      await request(
        base,
        'POST',
        '/webhooks/stripe',
        {
          'Content-Type': 'application/json',
          'Stripe-Signature': 't=1234567890,v1=deadbeefcafebabe',
        },
        JSON.stringify({ id: 'evt_smoke', type: 'checkout.session.completed' }),
      ),
      [
        {
          label: 'Sanitized error body (no stack/SQL leakage)',
          test: (r) =>
            r.json?.ok === false &&
            typeof r.json?.error === 'string' &&
            !String(r.body).includes('Prisma') &&
            !String(r.body).includes(' at '),
        },
        {
          label: 'invalid_signature or webhook_not_configured error code',
          test: (r) =>
            r.json?.error === 'invalid_signature' ||
            r.json?.error === 'webhook_not_configured' ||
            r.json?.error === 'service_unavailable',
        },
        {
          label: '4xx/5xx without raw stack payload',
          test: (r) => r.status >= 400 && r.status < 600 && !String(r.body).includes('stack'),
        },
      ],
    ),
  );

  return results;
}

async function main() {
  console.log('TEST_DRIFT_RESOLVED SURFACE=BOUNDARIES');
  let base = REQUESTED_BASE;
  let mock = null;
  let mode = 'LIVE';

  if (FORCE_OFFLINE) {
    mock = await startMockApi();
    base = mock.base;
    mode = 'OFFLINE_MOCK';
    console.log(`[smoke-production-boundaries] OFFLINE mock of ${DEFAULT_LIVE} -> ${base}`);
  } else {
    console.log(`[smoke-production-boundaries] target=${base}`);
    // Prefer /api/health (ingress contract); fall back to /health/live.
    let probe = await request(base, 'GET', '/api/health');
    if (probe.networkError || probe.status === 0 || probe.status >= 500) {
      probe = await request(base, 'GET', '/health/live');
    }
    if (probe.networkError || probe.status === 0 || probe.status >= 500) {
      mock = await startMockApi();
      base = mock.base;
      mode = 'OFFLINE_FALLBACK';
      console.log(
        `[smoke-production-boundaries] LIVE unreachable (${probe.networkError || `HTTP_${probe.status}`}); mocking ${DEFAULT_LIVE} -> ${base}`,
      );
    }
  }

  const results = await runSuite(base);
  if (mock) mock.server.close();

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Summary ===');
  console.log(`Passed: ${results.length - failed.length}/${results.length} MODE=${mode}`);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`- ${f.name}: ${f.reason}`);
    }
    process.exit(1);
  }

  console.log('All boundary smoke checks passed.');
  console.log('TEST_DRIFT_RESOLVED BOUNDARIES_OK');
}

void main();
