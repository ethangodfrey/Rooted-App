import { Link } from 'react-router-dom';

/**
 * Shown when VITE_SUPABASE_* were not baked into the bundle at build time.
 */
export function SupabaseConfigNotice() {
  const isProd = import.meta.env.PROD;

  return (
    <div className="auth-screen">
      <div className="auth-screen__inner">
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <h1 className="app-title">Supabase not configured</h1>
        {isProd ? (
          <p className="app-subtitle">
            This deployment was built without Supabase credentials. Add{' '}
            <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in
            Vercel → Project → Settings → Environment Variables (Production and Preview), then{' '}
            <strong>Redeploy</strong>. Values are baked in at build time — changing env vars
            requires a new deploy. See <code>docs/DEPLOY.md</code> in the repo.
          </p>
        ) : (
          <p className="app-subtitle">
            Copy <code>web/.env.example</code> to <code>web/.env</code> and add your Supabase
            project URL and anon key.
          </p>
        )}
      </div>
    </div>
  );
}
