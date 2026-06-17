import { FontAwesome } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { DiscoverThumb } from '@/src/components/discover/discover-thumb';
import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { formatPrice } from '@/src/lib/format';
import { formatExpiresIn, type CuratedLeftover } from '@/src/lib/leftovers';
import { pickListingDisplayImage } from '@/src/lib/product-image';
import { formatDistance } from '@/src/lib/geo';

interface LeftoverCardProps {
  listing: CuratedLeftover;
  onPress?: () => void;
  compact?: boolean;
}

export function LeftoverCard({ listing, onPress, compact = false }: LeftoverCardProps) {
  const displayImageUrl = pickListingDisplayImage(listing.media_url);

  const content = (
    <Card className={compact ? 'p-3' : undefined}>
      <View className="flex-row gap-3">
        <DiscoverThumb
          imageUrl={displayImageUrl}
          category={listing.vendor?.category ?? 'Food & Drink'}
        />
        <View className="flex-1">
          <Text variant="body" className="font-semibold" numberOfLines={2}>
            {listing.title}
          </Text>
          <Text variant="caption" className="mb-1">
            {listing.vendor?.business_name ?? 'Vendor'} · {formatPrice(listing.price_cents)}
          </Text>
          <Text variant="caption" className="text-warn">
            {formatExpiresIn(listing.hoursLeft)}
            {listing.quantity_remaining > 1
              ? ` · ${listing.quantity_remaining} left`
              : ' · Last one'}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {listing.locationLabel}
            {listing.distanceMiles != null ? ` · ${formatDistance(listing.distanceMiles)}` : ''}
          </Text>
        </View>
        {onPress ? <FontAwesome name="chevron-right" size={14} color="#9CAF88" /> : null}
      </View>
    </Card>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}
