import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

export function SupportPage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow legal-page">
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Support
        </h1>
        <p className="app-subtitle">We&apos;re here to help with Rooted.</p>

        <div className="legal-prose">
          <p>
            Email us at{' '}
            <a href="mailto:support@rooted.app">support@rooted.app</a> for account issues, vendor
            applications, or bug reports.
          </p>
          <p>
            For password resets, use <Link to="/forgot-password">Forgot password</Link> on the sign-in
            page.
          </p>
          <p>
            To delete your account, sign in and use <strong>Delete account</strong> on your Profile
            screen.
          </p>
        </div>
      </div>
    </div>
  );
}
