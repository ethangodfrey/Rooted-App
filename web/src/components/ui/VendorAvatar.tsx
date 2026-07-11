import { categoryVisual } from '@/lib/category-visuals';

import { SafeImage } from './SafeImage';

interface VendorAvatarProps {
  logoUrl?: string | null;
  businessName?: string | null;
  category?: string | null;
  size?: number;
  className?: string;
}

export function VendorAvatar({
  logoUrl,
  businessName,
  category,
  size = 56,
  className = '',
}: VendorAvatarProps) {
  const visual = categoryVisual(category);
  const initial = (businessName ?? 'V').trim().charAt(0).toUpperCase();
  const sizeStyle = { width: size, height: size };

  return (
    <SafeImage
      src={logoUrl ?? undefined}
      alt=""
      className={`app-vendor-avatar ${className}`.trim()}
      style={sizeStyle}
      fallback={
        <div
          className="app-vendor-avatar app-vendor-avatar--fallback"
          style={sizeStyle}
          aria-hidden="true"
        >
          <span className="app-vendor-avatar__glyph">{initial || visual.emoji}</span>
        </div>
      }
    />
  );
}
