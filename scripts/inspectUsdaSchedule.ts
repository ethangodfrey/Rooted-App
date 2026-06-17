import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadEnv();
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) throw new Error('Missing USDA_API_KEY');

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.usdalocalfoodportal.com/',
  };

  const res = await fetch(
    `https://www.usdalocalfoodportal.com/api/farmersmarket/?apikey=${encodeURIComponent(key)}&state=ca`,
    { headers },
  );
  const data = await res.json();
  const arr = Array.isArray(data) ? data : ((data as { data?: unknown }).data ?? []);
  const records = arr as Record<string, unknown>[];

  console.log('count', records.length);
  if (records[0]) console.log('keys', Object.keys(records[0]).sort().join(', '));

  const sunday = records.find((r) =>
    String(r.listing_name ?? '')
      .toLowerCase()
      .includes('sunday'),
  );
  console.log('sunday sample', JSON.stringify(sunday, null, 2));

  const detailId = sunday?.listing_id ?? records[0]?.listing_id;
  if (detailId) {
    const detailRes = await fetch(
      `https://www.usdalocalfoodportal.com/api/listinginfo/?lid=${detailId}&directory_type=farmersmarket`,
      { headers },
    );
    const detailText = await detailRes.text();
    console.log('detail snippet', detailText.slice(0, 3000));
  }
}

main().catch(console.error);
