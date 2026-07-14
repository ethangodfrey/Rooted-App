/**
 * Service-role writer for public.pos_webhook_logs (Phase 45 audit trail).
 */

export interface PosWebhookLogInsert {
  provider: 'square' | 'toast' | 'clover';
  providerEventId?: string | null;
  eventType?: string | null;
  signatureValid?: boolean | null;
  accepted: boolean;
  httpStatus?: number | null;
  providerMerchantId?: string | null;
  providerLocationId?: string | null;
  vendorId?: string | null;
  tenantId?: string | null;
  connectionId?: string | null;
  rawBody: string;
  rawPayload?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
  errorMessage?: string | null;
}

function supabaseServiceConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

function sanitizeHeaders(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (lower.includes('authorization') || lower.includes('cookie')) continue;
    out[lower] = value;
  }
  return out;
}

export async function insertPosWebhookLog(
  row: PosWebhookLogInsert,
): Promise<{ id: string } | null> {
  const config = supabaseServiceConfig();
  if (!config) {
    console.warn('[pos-webhook-audit] SUPABASE_SERVICE_ROLE_KEY missing — skipping audit log');
    return null;
  }

  let rawPayload = row.rawPayload ?? {};
  if (!row.rawPayload) {
    try {
      rawPayload = JSON.parse(row.rawBody || '{}') as Record<string, unknown>;
    } catch {
      rawPayload = { parse_error: true };
    }
  }

  const res = await fetch(`${config.url}/rest/v1/pos_webhook_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      provider: row.provider,
      provider_event_id: row.providerEventId ?? null,
      event_type: row.eventType ?? null,
      signature_valid: row.signatureValid ?? null,
      accepted: row.accepted,
      http_status: row.httpStatus ?? null,
      provider_merchant_id: row.providerMerchantId ?? null,
      provider_location_id: row.providerLocationId ?? null,
      vendor_id: row.vendorId ?? null,
      tenant_id: row.tenantId ?? null,
      connection_id: row.connectionId ?? null,
      raw_body: row.rawBody,
      raw_payload: rawPayload,
      headers: sanitizeHeaders(row.headers),
      error_message: row.errorMessage ?? null,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[pos-webhook-audit] insert failed: ${detail.slice(0, 300)}`);
    return null;
  }

  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0] ?? null;
}
