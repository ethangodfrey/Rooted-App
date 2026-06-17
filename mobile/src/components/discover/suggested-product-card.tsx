import { Pressable, View } from 'react-native';

import { DiscoverThumb } from '@/src/components/discover/discover-thumb';
import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { formatPrice } from '@/src/lib/format';
import type { SuggestedProduct } from '@/src/lib/suggested-products';

interface SuggestedProductCardProps {
  product: SuggestedProduct;
  onPress?: () => void;
}

export function SuggestedProductCard({ product, onPress }: SuggestedProductCardProps) {
  const content = (
    <Card className="flex-row items-center px-4 py-3.5">
      <View className="mr-3">
        <DiscoverThumb
          imageUrl={product.displayImageUrl}
          category={product.category ?? product.matchedInterest}
        />
      </View>
      <View className="min-w-0 flex-1 pr-2">
        <Text variant="body" className="font-semibold" numberOfLines={2}>
          {product.name}
        </Text>
        <Text variant="caption" className="mt-0.5">
          {product.vendor?.business_name ?? 'Vendor'} · {formatPrice(product.price)}
        </Text>
        <Text variant="caption" className="mt-0.5 text-forest">
          {product.matchedInterest}
        </Text>
      </View>
    </Card>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}
