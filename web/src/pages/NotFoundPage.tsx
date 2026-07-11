import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

export function NotFoundPage() {
  return (
    <div className="app-screen app-screen--narrow" style={{ textAlign: 'center' }}>
      <p className="app-eyebrow">Error 404</p>
      <h1 className="app-title">Page not found</h1>
      <p className="app-subtitle">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Link to="/app" className="app-btn app-btn--primary" style={{ marginTop: '1rem' }}>
        Go to your dashboard
      </Link>
      <Link to="/" className="auth-home-link" style={{ marginTop: '1rem' }}>
        ← Back to home
      </Link>
    </div>
  );
}
