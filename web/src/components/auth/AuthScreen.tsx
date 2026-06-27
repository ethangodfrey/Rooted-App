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
  socialAuth?: React.ReactNode;
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
  socialAuth,
}: AuthScreenProps) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__inner">
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <div className="auth-screen__logo">
          <Logo size="medium" />
        </div>
        <h1 className="app-title">{title}</h1>
        {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}

        <form
          className="app-card auth-screen__form"
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

          {socialAuth}
        </form>

        {footer ? <div className="auth-screen__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="auth-screen__link">
      {children}
    </Link>
  );
}
