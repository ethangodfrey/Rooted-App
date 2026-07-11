/**
 * Fail production/CI builds when Supabase Vite env vars are missing.
 * Prevents shipping a bundle that shows "Supabase not configured" on Vercel.
 */
const isHostedBuild = Boolean(process.env.VERCEL || process.env.CI);

if (!isHostedBuild) {
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const placeholder =
  !url ||
  !key ||
  url.includes('your-project-ref') ||
  key.includes('your-anon-key');

if (placeholder) {
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

console.log('[verify-build-env] Supabase Vite env vars present.');
