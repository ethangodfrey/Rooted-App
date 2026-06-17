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

async function fetchDetail(id: string) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.usdalocalfoodportal.com/',
  };
  const res = await fetch(
    `https://www.usdalocalfoodportal.com/api/listinginfo/?lid=${id}&directory_type=farmersmarket`,
    { headers },
  );
  return res.json() as Promise<Record<string, string>>;
}

async function main() {
  loadEnv();
  const detail = await fetchDetail('301220');
  for (const key of Object.keys(detail).sort()) {
    const value = detail[key] ?? '';
    if (/operat|hour|time|day|season/i.test(key) || /operat|hour|sunday|saturday/i.test(value)) {
      console.log('\n===', key, '===');
      console.log(String(value).slice(0, 1200));
    }
  }
}

main().catch(console.error);
