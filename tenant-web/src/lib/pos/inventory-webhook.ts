import { createHmac, timingSafeEqual } from 'node:crypto';

export type PosInventoryProvider = 'SQUARE' | 'TOAST';

export interface ParsedInventoryWebhook {
  provider: PosInventoryProvider;
  providerEventId: string;
  eventType: string;
  signatureValid: boolean;
  providerMerchantId?: string;
  providerLocationId?: string;
  providerCatalogObjectId: string;
  quantityDelta?: number;
  quantityAbsolute?: number;
  rawPayload: Record<string, unknown>;
}

const INVENTORY_EVENT_PREFIXES = ['inventory.', 'stock.', 'menu_item_inventory'];

export function isInventoryWebhookEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return INVENTORY_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function readBody(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function verifyHmac(
  secret: string,
  provided: string,
  payload: string,
): boolean {
  if (!secret || !provided) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('base64');
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifySquareInventoryWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  options: { signatureKey: string; notificationUrl: string },
): ParsedInventoryWebhook | null {
  const provided = headers['x-square-hmacsha256-signature'] ?? '';
  const signatureValid = (() => {
    if (!options.signatureKey || !provided) return false;
    const expected = createHmac('sha256', options.signatureKey)
      .update(options.notificationUrl + rawBody)
      .digest('base64');
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  })();

  const payload = readBody(rawBody);
  const eventType = String(payload.type ?? 'unknown');
  if (!isInventoryWebhookEvent(eventType)) return null;

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
    provider: 'SQUARE',
    providerEventId: String(payload.event_id ?? payload.id ?? ''),
    eventType,
    signatureValid,
    providerMerchantId: payload.merchant_id ? String(payload.merchant_id) : undefined,
    providerLocationId: first.location_id ? String(first.location_id) : undefined,
    providerCatalogObjectId: catalogId,
    quantityAbsolute: Number.isFinite(quantityAbsolute) ? quantityAbsolute : undefined,
    rawPayload: payload,
  };
}

export function verifyToastInventoryWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  options: { webhookSecret: string },
): ParsedInventoryWebhook | null {
  const provided = headers['toast-signature'] ?? '';
  const signatureValid = verifyHmac(options.webhookSecret, provided, rawBody);

  const payload = readBody(rawBody);
  const eventType = String(payload.eventType ?? payload.event_type ?? 'unknown');
  if (!isInventoryWebhookEvent(eventType)) return null;

  const catalogId = String(
    payload.menuItemGuid ??
      payload.menu_item_guid ??
      payload.catalogObjectId ??
      payload.catalog_object_id ??
      '',
  );
  if (!catalogId) return null;

  const quantityAbsoluteRaw =
    payload.quantity ?? payload.onHandCount ?? payload.on_hand_count ?? payload.count;
  const quantityDeltaRaw = payload.quantityDelta ?? payload.quantity_delta;

  const quantityAbsolute =
    quantityAbsoluteRaw != null ? Math.trunc(Number(quantityAbsoluteRaw)) : undefined;
  const quantityDelta =
    quantityDeltaRaw != null ? Math.trunc(Number(quantityDeltaRaw)) : undefined;

  return {
    provider: 'TOAST',
    providerEventId: String(payload.eventId ?? payload.guid ?? payload.id ?? ''),
    eventType,
    signatureValid,
    providerMerchantId: payload.restaurantGuid
      ? String(payload.restaurantGuid)
      : undefined,
    providerLocationId: payload.restaurantGuid
      ? String(payload.restaurantGuid)
      : undefined,
    providerCatalogObjectId: catalogId,
    quantityAbsolute: Number.isFinite(quantityAbsolute) ? quantityAbsolute : undefined,
    quantityDelta: Number.isFinite(quantityDelta) ? quantityDelta : undefined,
    rawPayload: payload,
  };
}

export function parseInventoryWebhook(
  provider: PosInventoryProvider,
  rawBody: string,
  headers: Record<string, string | undefined>,
): ParsedInventoryWebhook | null {
  if (provider === 'SQUARE') {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() ?? '';
    const notificationUrl = process.env.POS_INVENTORY_WEBHOOK_URL?.trim() ?? '';
    return verifySquareInventoryWebhook(rawBody, headers, { signatureKey, notificationUrl });
  }

  const webhookSecret = process.env.TOAST_WEBHOOK_SECRET?.trim() ?? '';
  return verifyToastInventoryWebhook(rawBody, headers, { webhookSecret });
}
