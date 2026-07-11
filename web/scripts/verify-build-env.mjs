/**
 * Fail production/CI builds when required Vite env vars are missing.
 * Development defaults are untouched — checks only run on Vercel/CI hosts.
 */
const isHostedBuild = Boolean(process.env.VERCEL || process.env.CI);

if (!isHostedBuild) {
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const apiUrl = process.env.VITE_API_URL?.trim() ?? '';
const vercelEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? '';

const placeholderSupabase =
  !url ||
  !key ||
  url.includes('your-project-ref') ||
  key.includes('your-anon-key');

if (placeholderSupabase) {
  console.error('');
  console.error('Build blocked: Supabase env vars are required for Vercel/CI builds.');
  console.error('');
  console.error('  VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co');
  console.error('  VITE_SUPABASE_ANON_KEY=<anon public key from Supabase → Settings → API>');
  console.error('');
  console.error('Add both in Vercel → Project → Settings → Environment Variables');
  console.error('(Production + Preview), then redeploy. See docs/DEPLOY.md.');
  console.error('');
  process.exit(1);
}

const isProductionTarget = vercelEnv === 'production';
const apiLooksProduction =
  apiUrl.startsWith('https://') && !apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1');

if (isProductionTarget && !apiLooksProduction) {
  console.error('');
  console.error('Build blocked: production web builds require VITE_API_URL.');
  console.error('');
  console.error('  VITE_API_URL=https://api.vendorly.app');
  console.error('');
  console.error('Set in Vercel → Environment Variables → Production only.');
  console.error('Preview/dev builds may omit VITE_API_URL for Supabase-only mode.');
  console.error('');
  process.exit(1);
}

console.log('[verify-build-env] Supabase Vite env vars present.');
if (apiUrl) {
  console.log(`[verify-build-env] VITE_API_URL configured (${isProductionTarget ? 'production' : vercelEnv || 'ci'}).`);
}
