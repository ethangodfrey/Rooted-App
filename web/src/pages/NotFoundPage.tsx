import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

export function NotFoundPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Page not found</h1>
      <p className="app-subtitle">
        That link may be outdated or mistyped. Head back to Rooted to keep exploring.
      </p>
      <div className="app-list" style={{ marginTop: '1.5rem' }}>
        <Link to="/" className="app-btn app-btn--primary">
          Go to home
        </Link>
        <Link to="/app" className="app-btn app-btn--secondary">
          Open app
        </Link>
      </div>
    </div>
  );
}
