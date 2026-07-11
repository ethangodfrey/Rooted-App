import { useState } from 'react';

type VendorImageVariant = 'logo' | 'banner';

interface VendorImageProps {
  src?: string | null;
  variant?: VendorImageVariant;
  businessName?: string | null;
  className?: string;
}

function fallbackLabel(businessName?: string | null): string {
  const trimmed = businessName?.trim();
  if (!trimmed) return '🏪';
  return trimmed.charAt(0).toUpperCase();
}

export function VendorImage({
  src,
  variant = 'logo',
  businessName,
  className = '',
}: VendorImageProps) {
  const [failed, setFailed] = useState(false);
  const isBanner = variant === 'banner';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={className}
        onError={() => setFailed(true)}
        style={
          isBanner
            ? {
                width: '100%',
                borderRadius: 16,
                marginBottom: '1rem',
                maxHeight: 200,
                objectFit: 'cover',
                background: 'var(--color-line, #e8e8e8)',
              }
            : {
                width: 56,
                height: 56,
                borderRadius: 12,
                objectFit: 'cover',
                flexShrink: 0,
                background: 'var(--color-line, #e8e8e8)',
              }
        }
      />
    );
  }

  if (isBanner) {
    return (
      <div
        className={`app-thumb-fallback app-thumb-fallback--vendor ${className}`.trim()}
        style={{
          width: '100%',
          height: 140,
          borderRadius: 16,
          marginBottom: '1rem',
          fontSize: '2.5rem',
        }}
        aria-hidden="true"
      >
        <span className="app-thumb-fallback__icon">🏪</span>
      </div>
    );
  }

  return (
    <div
      className={`app-thumb-fallback app-thumb-fallback--vendor app-row-icon ${className}`.trim()}
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        flexShrink: 0,
        fontSize: '1.25rem',
        fontWeight: 700,
      }}
      aria-hidden="true"
    >
      <span className="app-thumb-fallback__icon">{fallbackLabel(businessName)}</span>
    </div>
  );
}
