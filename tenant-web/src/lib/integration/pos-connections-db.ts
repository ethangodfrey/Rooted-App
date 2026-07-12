import type { PosIntegrationProvider, VendorPosConnectionRow } from '@/lib/integration/types';

function supabaseServiceConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

export async function fetchVendorForUser(
  vendorId: string,
  userId: string,
): Promise<{ id: string; user_id: string } | null> {
  const config = supabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    id: `eq.${vendorId}`,
    user_id: `eq.${userId}`,
    select: 'id,user_id',
    limit: '1',
  });

  const res = await fetch(`${config.url}/rest/v1/vendors?${params.toString()}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string; user_id: string }>;
  return rows[0] ?? null;
}

export async function upsertVendorPosConnection(
  row: VendorPosConnectionRow,
): Promise<{ id: string } | null> {
  const config = supabaseServiceConfig();
  if (!config) return null;

  const res = await fetch(
    `${config.url}/rest/v1/vendor_pos_connections?on_conflict=vendor_id,provider`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        ...row,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`vendor_pos_connections upsert failed: ${detail.slice(0, 300)}`);
  }

  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0] ?? null;
}

export async function markConnectionOAuthError(
  provider: PosIntegrationProvider,
  oauthState: string,
  message: string,
): Promise<void> {
  const config = supabaseServiceConfig();
  if (!config) return;

  await fetch(
    `${config.url}/rest/v1/vendor_pos_connections?oauth_state=eq.${encodeURIComponent(oauthState)}&provider=eq.${provider}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
      body: JSON.stringify({
        status: 'error',
        metadata: { oauthError: message },
        updated_at: new Date().toISOString(),
      }),
    },
  );
}
