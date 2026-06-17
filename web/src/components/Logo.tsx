import './Logo.css';

type LogoProps = {
  variant?: 'primary' | 'reversed';
  size?: 'small' | 'medium' | 'large';
};

export function Logo({ variant = 'primary', size = 'medium' }: LogoProps) {
  return (
    <span className={`logo logo--${variant} logo--${size}`} aria-label="Rooted">
      Rooted
    </span>
  );
}
