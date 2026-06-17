import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  showPassword?: boolean;
  loading?: boolean;
  error?: string | null;
  message?: string | null;
  footer?: React.ReactNode;
}

export function AuthScreen({
  title,
  subtitle,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  submitLabel,
  showPassword = true,
  loading = false,
  error,
  message,
  footer,
}: AuthScreenProps) {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '4rem' }}>
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          {title}
        </h1>
        {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="app-input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="app-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {showPassword ? (
            <div className="app-input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="app-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          ) : null}

          {error ? <p className="app-error">{error}</p> : null}
          {message ? <p className="app-message">{message}</p> : null}

          <button type="submit" className="app-btn app-btn--primary" disabled={loading}>
            {loading ? 'Please wait…' : submitLabel}
          </button>
        </form>

        {footer ? <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} style={{ color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: '0.75rem' }}>
      {children}
    </Link>
  );
}
