#!/usr/bin/env node
/**
 * Smoke-test production CORS boundaries and Stripe webhook error sanitization.
 *
 * Usage:
 *   API_BASE=https://api.vendorly.app node scripts/smoke-production-boundaries.mjs
 *   API_BASE=http://localhost:4000 node scripts/smoke-production-boundaries.mjs
 */
const API_BASE = (process.env.API_BASE ?? 'https://api.vendorly.app').replace(/\/$/, '');

async function request(method, path, headers = {}, body) {
  const url = `${API_BASE}${path}`;
  const init = { method, headers };
  if (body != null) {
    init.body = body;
  }

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

async function main() {
  console.log(`[smoke-production-boundaries] target=${API_BASE}`);

  const results = [];

  results.push(
    printResult(
      'CORS deny — unauthorized origin (evil.example.com)',
      await request('GET', '/health/live', { Origin: 'https://evil.example.com' }),
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
      'CORS allow — vendorly.app',
      await request('GET', '/health/live', { Origin: 'https://vendorly.app' }),
      [
        {
          label: 'ACAO present for vendorly.app',
          test: (r) => r.headers['access-control-allow-origin'] === 'https://vendorly.app',
        },
      ],
    ),
  );

  results.push(
    printResult(
      'CORS allow — vendorly subdomain',
      await request('GET', '/health/live', { Origin: 'https://shop.vendorly.app' }),
      [
        {
          label: 'ACAO present for *.vendorly.app subdomain',
          test: (r) => r.headers['access-control-allow-origin'] === 'https://shop.vendorly.app',
        },
      ],
    ),
  );

  results.push(
    printResult(
      'Health — no Origin header',
      await request('GET', '/health/live'),
      [
        {
          label: 'Health responds 200 without Origin',
          test: (r) => r.status === 200,
        },
      ],
    ),
  );

  results.push(
    printResult(
      'Webhook — corrupted Stripe signature',
      await request(
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

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Summary ===');
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`- ${f.name}: ${f.reason}`);
    }
    process.exit(1);
  }

  console.log('All boundary smoke checks passed.');
}

void main();
