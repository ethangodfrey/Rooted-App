import { useEffect, useState } from 'react';

import { badgeLabel, fetchAwardedBadges, type AwardedBadge } from '@/lib/trust-badges';
import './TrustBadges.css';

interface TrustBadgesProps {
  /** The creator's `users.id` (vendor.user_id / chef.user_id). */
  userId: string | null | undefined;
  className?: string;
}

/**
 * Renders the public trust badges awarded to a creator as small chips.
 * Fetches once per `userId` and renders nothing when there are no badges.
 */
export function TrustBadges({ userId, className }: TrustBadgesProps) {
  const [badges, setBadges] = useState<AwardedBadge[]>([]);

  useEffect(() => {
    if (!userId) {
      setBadges([]);
      return;
    }
    let cancelled = false;
    void fetchAwardedBadges(userId).then((result) => {
      if (!cancelled) setBadges(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (badges.length === 0) return null;

  return (
    <div className={`trust-badges${className ? ` ${className}` : ''}`}>
      {badges.map((badge) => (
        <span key={badge.id} className="trust-badge" title={badge.badge_description ?? undefined}>
          <span aria-hidden="true" className="trust-badge__check">
            ✓
          </span>
          {badgeLabel(badge)}
        </span>
      ))}
    </div>
  );
}
