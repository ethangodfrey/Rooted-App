import { FontAwesome } from '@expo/vector-icons';
import { Image, Linking, Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import {
  parseThemeSettings,
  resolveAccentColor,
} from '@/src/lib/vendor-storefront';
import { colors } from '@/src/theme/colors';
import { pagePadding, radius } from '@/src/theme/layout';
import type { Vendor } from '@/src/types/database';

interface VendorStorefrontHeaderProps {
  vendor: Vendor;
  showLinks?: boolean;
}

export function VendorStorefrontHeader({ vendor, showLinks = true }: VendorStorefrontHeaderProps) {
  const theme = parseThemeSettings(vendor.theme_settings);
  const accent = resolveAccentColor(theme.accent_color);
  const location = [vendor.sell_city, vendor.sell_state].filter(Boolean).join(', ');
  const channels = vendor.selling_channels ?? [];

  async function openUrl(raw: string | null) {
    if (!raw?.trim()) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    await Linking.openURL(url);
  }

  return (
    <View className="mb-6">
      <View style={{ marginHorizontal: -pagePadding, marginTop: -16 }}>
        {vendor.banner_url ? (
          <Image
            source={{ uri: vendor.banner_url }}
            style={{ width: '100%', height: 168, backgroundColor: colors.honeydew }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              height: 168,
              backgroundColor: colors.honeydew,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <FontAwesome name="image" size={28} color={colors.sage} />
          </View>
        )}
      </View>

      <View style={{ marginTop: -36, marginBottom: 12 }}>
        {vendor.logo_url ? (
          <Image
            source={{ uri: vendor.logo_url }}
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.card,
              borderWidth: 3,
              borderColor: colors.white,
              backgroundColor: colors.white,
            }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.card,
              borderWidth: 3,
              borderColor: colors.white,
              backgroundColor: colors.honeydew,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <FontAwesome name="shopping-bag" size={26} color={accent} />
          </View>
        )}
      </View>

      <Text variant="title" className="mb-1">
        {vendor.business_name ?? 'Vendor'}
      </Text>

      {vendor.category ? (
        <Text variant="eyebrow" style={{ color: accent, marginBottom: 8 }}>
          {vendor.category}
        </Text>
      ) : null}

      {vendor.product_summary ? (
        <Text variant="subtitle" className="mb-3">
          {vendor.product_summary}
        </Text>
      ) : null}

      {theme.featured_highlight ? (
        <View
          style={{
            borderRadius: radius.card,
            backgroundColor: colors.honeydew,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 12,
            borderLeftWidth: 4,
            borderLeftColor: accent,
          }}>
          <Text variant="body" className="font-semibold">
            {theme.featured_highlight}
          </Text>
        </View>
      ) : null}

      {location || vendor.primary_market ? (
        <View className="mb-3 gap-2">
          {location ? (
            <View className="flex-row items-center">
              <FontAwesome name="map-marker" size={13} color={colors.sage} />
              <Text variant="caption" className="ml-2">
                Based in {location}
              </Text>
            </View>
          ) : null}
          {vendor.primary_market ? (
            <View className="flex-row items-center">
              <FontAwesome name="calendar" size={13} color={colors.sage} />
              <Text variant="caption" className="ml-2">
                Often at {vendor.primary_market}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {channels.length > 0 ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {channels.map((channel) => (
            <View
              key={channel}
              style={{
                borderRadius: radius.pill,
                backgroundColor: colors.honeydew,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>{channel}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {vendor.business_description ? (
        <View className="mb-4">
          <Text variant="heading" className="mb-2">
            About
          </Text>
          <Text variant="body">{vendor.business_description}</Text>
        </View>
      ) : null}

      {theme.pickup_info ? (
        <View className="mb-4">
          <Text variant="heading" className="mb-2">
            Pickup & ordering
          </Text>
          <Text variant="body">{theme.pickup_info}</Text>
        </View>
      ) : null}

      {theme.payment_methods && theme.payment_methods.length > 0 ? (
        <View className="mb-4">
          <Text variant="heading" className="mb-2">
            Payment
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {theme.payment_methods.map((method) => (
              <View
                key={method}
                style={{
                  borderRadius: radius.pill,
                  backgroundColor: colors.honeydew,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{method}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {showLinks && (vendor.instagram_url || vendor.website_url) ? (
        <View className="flex-row flex-wrap gap-3">
          {vendor.instagram_url ? (
            <Pressable onPress={() => openUrl(vendor.instagram_url)} className="flex-row items-center">
              <FontAwesome name="instagram" size={16} color={accent} />
              <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: accent }}>
                Instagram
              </Text>
            </Pressable>
          ) : null}
          {vendor.website_url ? (
            <Pressable onPress={() => openUrl(vendor.website_url)} className="flex-row items-center">
              <FontAwesome name="globe" size={16} color={accent} />
              <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: accent }}>
                Website
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
