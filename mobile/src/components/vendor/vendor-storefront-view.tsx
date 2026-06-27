import { FontAwesome } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { VendorStorefrontHeader } from '@/src/components/vendor/vendor-storefront-header';
import { formatPrice } from '@/src/lib/format';
import { parseThemeSettings, resolveAccentColor } from '@/src/lib/vendor-storefront';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/layout';
import type { Vendor } from '@/src/types/database';

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  reserve_enabled: boolean;
  media_urls: string[];
  product_event_availability: { available_quantity_presale: number }[];
}

function isReservable(product: StorefrontProduct): boolean {
  return (
    product.reserve_enabled &&
    product.product_event_availability.some((a) => a.available_quantity_presale > 0)
  );
}

interface VendorStorefrontViewProps {
  vendor: Vendor;
  products: StorefrontProduct[];
  previewMode?: boolean;
  onPressProduct?: (productId: string) => void;
  /** Optional content rendered under the business name (e.g. trust badges). */
  headerAccessory?: ReactNode;
}

export function VendorStorefrontView({
  vendor,
  products,
  previewMode = false,
  onPressProduct,
  headerAccessory,
}: VendorStorefrontViewProps) {
  const accent = resolveAccentColor(parseThemeSettings(vendor.theme_settings).accent_color);

  return (
    <>
      {previewMode ? (
        <View
          style={{
            marginBottom: 16,
            borderRadius: radius.card,
            backgroundColor: colors.honeydew,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderLeftWidth: 4,
            borderLeftColor: colors.primary,
          }}>
          <Text variant="body" className="font-semibold">
            Shop preview
          </Text>
          <Text variant="caption" className="mt-1">
            {vendor.approval_status === 'approved'
              ? 'This matches what shoppers see on your live storefront.'
              : vendor.approval_status === 'pending'
                ? 'Your shop looks like this once approved. Shoppers cannot view it yet.'
                : 'Your application was not approved. Update your details and reapply.'}
          </Text>
        </View>
      ) : null}

      <VendorStorefrontHeader vendor={vendor} accessory={headerAccessory} />

      <Text variant="heading" className="mb-3">
        Products
      </Text>
      {products.length === 0 ? (
        <Text variant="caption">
          {previewMode
            ? 'Add products to show them here on your shop page.'
            : "This vendor hasn't listed any products yet."}
        </Text>
      ) : (
        <View className="gap-3">
          {products.map((product) => {
            const reservable = isReservable(product);
            const card = (
              <Card>
                <View className="flex-row items-start">
                  {product.media_urls?.length ? (
                    <Image
                      source={{ uri: product.media_urls[0] }}
                      className="mr-3 h-16 w-16 rounded-xl bg-line"
                    />
                  ) : (
                    <View className="mr-3 h-16 w-16 items-center justify-center rounded-xl bg-honeydew">
                      <FontAwesome name="cutlery" size={20} color="#9CAF88" />
                    </View>
                  )}
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text variant="body" className="font-semibold">
                          {product.name}
                        </Text>
                        <Text variant="caption" className="mt-0.5">
                          {formatPrice(product.price)}
                          {product.category ? ` · ${product.category}` : ''}
                        </Text>
                      </View>
                      {reservable ? (
                        <View
                          style={{
                            borderRadius: 999,
                            backgroundColor: colors.honeydew,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                          }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>
                            Reservable
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {product.description ? (
                      <Text variant="caption" className="mt-2">
                        {product.description}
                      </Text>
                    ) : null}
                    {!previewMode ? (
                      <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: accent }}>
                        {reservable ? 'View & reserve →' : 'View details →'}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            );

            if (previewMode || !onPressProduct) {
              return <View key={product.id}>{card}</View>;
            }

            return (
              <Pressable key={product.id} onPress={() => onPressProduct(product.id)}>
                {card}
              </Pressable>
            );
          })}
        </View>
      )}

      <Text variant="caption" className="mt-6">
        {previewMode
          ? 'Return to Edit storefront to change banner, logo, about, and links.'
          : 'Reserve now and pay the vendor at pickup.'}
      </Text>
    </>
  );
}
