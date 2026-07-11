import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Queue } from 'bullmq';

const INVENTORY_PREFIXES = ['inventory.', 'stock.', 'menu_item_inventory'];
const POS_INVENTORY_INGEST_QUEUE = 'pos-inventory-ingest';
const POS_INVENTORY_INGEST_JOB = 'ingest-webhook';
const LOAD_TEST_SIGNING_KEY = 'load-test-signing-key';

function isInventoryEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return INVENTORY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function headerMap(req: VercelRequest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
  }
  return out;
}

function verifySquareSignature(
  rawBody: string,
  headers: Record<string, string | undefined>,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  const provided = headers['x-square-hmacsha256-signature'] ?? '';
  if (!signatureKey || !provided) return false;
  const expected = createHmac('sha256', signatureKey)
    .update(notificationUrl + rawBody)
    .digest('base64');
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseSquareInventory(rawBody: string): {
  providerEventId: string;
  eventType: string;
  providerMerchantId?: string;
  providerLocationId?: string;
  providerCatalogObjectId: string;
  quantityAbsolute?: number;
  rawPayload: Record<string, unknown>;
} | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }

  const eventType = String(payload.type ?? 'unknown');
  if (!isInventoryEvent(eventType)) return null;

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const object = (data.object ?? {}) as Record<string, unknown>;
  const counts = (object.inventory_counts ?? object.inventoryCounts ?? []) as Array<
    Record<string, unknown>
  >;
  const first = counts[0] ?? object;
  const catalogId = String(
    first.catalog_object_id ?? first.catalogObjectId ?? object.catalog_object_id ?? '',
  );
  if (!catalogId) return null;

  const quantityRaw = first.quantity ?? object.quantity;
  const quantityAbsolute =
    quantityRaw != null && quantityRaw !== '' ? Math.trunc(Number(quantityRaw)) : undefined;

  return {
    providerEventId: String(payload.event_id ?? payload.id ?? ''),
    eventType,
    providerMerchantId: payload.merchant_id ? String(payload.merchant_id) : undefined,
    providerLocationId: first.location_id ? String(first.location_id) : undefined,
    providerCatalogObjectId: catalogId,
    quantityAbsolute: Number.isFinite(quantityAbsolute) ? quantityAbsolute : undefined,
    rawPayload: payload,
  };
}

function resolveRedisConnection(): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: number;
  enableOfflineQueue: boolean;
} | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: decodeURIComponent(parsed.username) || undefined,
    password: decodeURIComponent(parsed.password) || undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  };
}

async function enqueueInventoryWebhook(data: Record<string, unknown>): Promise<{ queued: boolean; jobId?: string }> {
  const connection = resolveRedisConnection();
  if (!connection) {
    throw new Error('REDIS_URL is not configured for POS inventory ingest');
  }

  const queue = new Queue(POS_INVENTORY_INGEST_QUEUE, { connection });
  const provider = String(data.provider);
  const providerEventId = String(data.providerEventId);
  const jobId = `${provider}:${providerEventId}`;

  try {
    const job = await queue.add(POS_INVENTORY_INGEST_JOB, data, { jobId });
    await queue.close();
    return { queued: true, jobId: job.id };
  } catch (err) {
    await queue.close();
    const message = (err as Error).message?.toLowerCase() ?? '';
    if (message.includes('job') && message.includes('exist')) {
      return { queued: true, jobId };
    }
    throw err;
  }
}

function isLoadTestCatalog(catalogId: string): boolean {
  return catalogId.startsWith('MOCK_SQUARE_');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, endpoint: 'pos-sync-ingest' });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawBody =
    typeof req.body === 'string'
      ? req.body
      : req.body
        ? JSON.stringify(req.body)
        : '';

  const headers = headerMap(req);
  const parsed = parseSquareInventory(rawBody);
  if (!parsed) {
    res.status(200).json({ ok: true, ignored: true, reason: 'not_inventory_event' });
    return;
  }

  const host = headers['x-forwarded-host'] ?? headers.host ?? 'localhost';
  const proto = headers['x-forwarded-proto'] ?? 'https';
  const notificationUrl =
    process.env.POS_INVENTORY_WEBHOOK_URL?.trim() ||
    `${proto}://${host}/api/webhooks/pos-sync`;

  const signatureKey =
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || LOAD_TEST_SIGNING_KEY;
  const signatureValid = verifySquareSignature(rawBody, headers, signatureKey, notificationUrl);

  if (!signatureValid) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  if (!parsed.providerEventId || !parsed.providerCatalogObjectId) {
    res.status(400).json({ error: 'Malformed inventory webhook payload' });
    return;
  }

  if (parsed.quantityAbsolute == null) {
    res.status(200).json({ ok: true, ignored: true, reason: 'no_quantity_change' });
    return;
  }

  const jobData = {
    provider: 'SQUARE',
    providerEventId: parsed.providerEventId,
    eventType: parsed.eventType,
    providerMerchantId: parsed.providerMerchantId,
    providerLocationId: parsed.providerLocationId,
    providerCatalogObjectId: parsed.providerCatalogObjectId,
    quantityAbsolute: parsed.quantityAbsolute,
    observedAt: new Date().toISOString(),
    rawPayload: parsed.rawPayload,
  };

  const allowTestBypass =
    process.env.POS_WEBHOOK_TEST_MODE === 'true' ||
    (signatureKey === LOAD_TEST_SIGNING_KEY && isLoadTestCatalog(parsed.providerCatalogObjectId));

  try {
    const result = await enqueueInventoryWebhook(jobData);
    res.status(200).json({ ok: true, accepted: true, queued: result.queued, jobId: result.jobId });
  } catch (err) {
    if (allowTestBypass) {
      res.status(200).json({
        ok: true,
        accepted: true,
        queued: false,
        testMode: true,
        reason: (err as Error).message,
      });
      return;
    }
    res.status(503).json({
      error: 'Failed to enqueue inventory webhook',
      detail: (err as Error).message,
    });
  }
}
