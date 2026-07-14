import type { EncryptedCredentialRow } from '@/lib/integration/types';

function supabaseServiceConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

/** Upsert AES-GCM sealed credentials. Service-role only. */
export async function upsertEncryptedCredentials(
  row: EncryptedCredentialRow,
): Promise<{ id: string } | null> {
  const config = supabaseServiceConfig();
  if (!config) {
    throw new Error('Supabase service role is not configured');
  }

  const res = await fetch(
    `${config.url}/rest/v1/encrypted_credentials?on_conflict=vendor_id,provider`,
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
    throw new Error(`encrypted_credentials upsert failed: ${detail.slice(0, 300)}`);
  }

  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0] ?? null;
}
