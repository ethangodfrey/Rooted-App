import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { FieldError } from '@/components/ui/FieldError';
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
  submitDisabled?: boolean;
  error?: string | null;
  fieldErrors?: { email?: string; password?: string };
  message?: string | null;
  beforeSubmit?: React.ReactNode;
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
  submitDisabled = false,
  error,
  fieldErrors,
  message,
  beforeSubmit,
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
              className={`app-input${fieldErrors?.email ? ' app-input--invalid' : ''}`}
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(fieldErrors?.email)}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
            />
            <FieldError message={fieldErrors?.email} />
          </div>

          {showPassword ? (
            <div className="app-input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className={`app-input${fieldErrors?.password ? ' app-input--invalid' : ''}`}
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(fieldErrors?.password)}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
              />
              <FieldError message={fieldErrors?.password} />
            </div>
          ) : null}

          {error ? <p className="app-error">{error}</p> : null}
          {message ? <p className="app-message">{message}</p> : null}

          {beforeSubmit}

          <button
            type="submit"
            className="app-btn app-btn--primary"
            disabled={loading || submitDisabled}
          >
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
