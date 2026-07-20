import { FallbackImage } from './FallbackImage';

type VendorImageVariant = 'logo' | 'banner';

interface VendorImageProps {
  src?: string | null;
  variant?: VendorImageVariant;
  businessName?: string | null;
  className?: string;
}

export function VendorImage({
  src,
  variant = 'logo',
  businessName,
  className = '',
}: VendorImageProps) {
  const isBanner = variant === 'banner';

  if (isBanner) {
    return (
      <FallbackImage
        src={src}
        variant="banner"
        className={className}
        style={{
          width: '100%',
          borderRadius: 16,
          marginBottom: '1rem',
          maxHeight: 200,
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <FallbackImage
      src={src}
      variant="vendor-logo"
      label={businessName ?? undefined}
      className={`app-row-icon ${className}`.trim()}
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
}
