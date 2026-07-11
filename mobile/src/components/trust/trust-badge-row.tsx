import { View } from 'react-native';

import { VerificationBadge } from '@/src/components/trust/verification-badge';
import type { AwardedBadge } from '@/src/lib/verification';

interface TrustBadgeRowProps {
  badges: AwardedBadge[];
  compact?: boolean;
  className?: string;
}

/**
 * Renders the trust badges awarded to a vendor/chef as a horizontal, wrapping
 * row, reusing the shared `VerificationBadge` styling. Renders nothing when
 * there are no badges to show.
 */
export function TrustBadgeRow({ badges, compact, className }: TrustBadgeRowProps) {
  if (!badges.length) return null;

  return (
    <View className={`flex-row flex-wrap gap-1.5 ${className ?? ''}`}>
      {badges.map((badge) => (
        <VerificationBadge key={badge.badge_type} badgeType={badge.badge_type} compact={compact} />
      ))}
    </View>
  );
}
