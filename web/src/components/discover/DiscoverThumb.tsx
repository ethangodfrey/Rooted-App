import { useState } from 'react';

import { categoryVisual } from '@/lib/category-visuals';

interface DiscoverThumbProps {
  imageUrl?: string | null;
  category?: string | null;
  size?: number;
}

export function DiscoverThumb({ imageUrl, category, size = 56 }: DiscoverThumbProps) {
  const [failed, setFailed] = useState(false);
  const visual = categoryVisual(category);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--color-line, #e8e8e8)',
        }}
      />
    );
  }

  return (
    <div
      className="app-row-icon"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
        fontSize: size * 0.4,
      }}
    >
      {visual.emoji}
    </div>
  );
}
