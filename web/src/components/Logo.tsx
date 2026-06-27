import { VENDORLY_TAGLINE } from '@/lib/branding';

import './Logo.css';

type LogoProps = {
  variant?: 'primary' | 'reversed';
  size?: 'small' | 'medium' | 'large';
  /** Show the "Marketplace™" sub-line under the wordmark. */
  showSubline?: boolean;
  /** Show the marketing tagline below the wordmark. */
  showTagline?: boolean;
};

export function Logo({
  variant = 'primary',
  size = 'medium',
  showSubline = false,
  showTagline = false,
}: LogoProps) {
  return (
    <span className={`logo logo--${variant} logo--${size}`} aria-label="Vendorly">
      <span className="logo__wordmark">Vendorly</span>
      {showSubline ? (
        <span className="logo__sub" aria-hidden="true">
          <span className="logo__sub-text">Marketplace</span>
          <span className="logo__tm">™</span>
        </span>
      ) : null}
      {showTagline ? <span className="logo__tagline">{VENDORLY_TAGLINE}</span> : null}
    </span>
  );
}
