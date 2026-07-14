/**
 * Fire a mock Square payment.updated against the pos-sales webhook.
 *
 * Usage:
 *   POS_SALES_WEBHOOK_TEST_MODE=true \\
 *   POS_WEBHOOK_TEST_SECRET=dev-test-secret \\
 *   npx tsx scripts/test-pos-sales-webhook.ts
 *
 * Optional:
 *   --url https://tenant-web-psi.vercel.app/api/webhooks/pos-sales
 *   --merchant MOCK_MERCHANT_PHASEC_E2E
 *   --location MOCK_LOCATION_PHASEC_E2E
 */

import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function arg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? (process.argv[idx + 1]?.trim() ?? fallback) : fallback;
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), 'tenant-web/.env'));
loadEnvFile(resolve(process.cwd(), 'backend/.env'));

const url = arg(
  '--url',
  process.env.POS_SALES_WEBHOOK_URL?.trim() ||
    'http://localhost:3000/api/webhooks/pos-sales',
);
const merchant = arg('--merchant', 'MOCK_MERCHANT_PHASEC_E2E');
const location = arg('--location', 'MOCK_LOCATION_PHASEC_E2E');
const testSecret =
  process.env.POS_WEBHOOK_TEST_SECRET?.trim() || 'dev-test-secret';
const signingKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || '';

const soldAt = new Date().toISOString();
const paymentId = `pay_harness_${Date.now()}`;
const eventId = randomUUID();

const payload = {
  merchant_id: merchant,
  type: 'payment.updated',
  event_id: eventId,
  created_at: soldAt,
  data: {
    type: 'payment',
    id: eventId,
    object: {
      payment: {
        id: paymentId,
        order_id: `order_${paymentId}`,
        location_id: location,
        status: 'COMPLETED',
        created_at: soldAt,
        updated_at: soldAt,
        source_type: 'CARD',
        amount_money: { amount: 2500, currency: 'USD' },
        card_details: { card: { card_brand: 'VISA' } },
      },
    },
  },
};

const rawBody = JSON.stringify(payload);
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-pos-webhook-test-secret': testSecret,
};

if (signingKey) {
  headers['x-square-hmacsha256-signature'] = createHmac('sha256', signingKey)
    .update(url + rawBody)
    .digest('base64');
} else {
  // Still need Square provider detection
  headers['x-square-hmacsha256-signature'] = 'test-bypass';
}

console.log('POST', url);
console.log('paymentId', paymentId);
console.log('eventId', eventId);

const res = await fetch(url, { method: 'POST', headers, body: rawBody });
const text = await res.text();
console.log('status', res.status);
console.log(text);

if (res.status !== 202 && res.status !== 200) {
  process.exit(1);
}

console.log(`
Verify in Supabase SQL Editor:

-- 1) Raw audit log
select id, provider, event_type, accepted, http_status, received_at
from public.pos_webhook_logs
order by received_at desc
limit 5;

-- 2) Processed analytics row
select id, external_transaction_id, gross_sales_cents, net_sales_cents, status, sold_at
from public.analytics_sales
where external_transaction_id = '${paymentId}';

-- 3) Ledger (Phase B)
select id, external_transaction_id, gross_amount, platform_fee, sold_at
from public.pos_transactions
where external_transaction_id = '${paymentId}';
`);
