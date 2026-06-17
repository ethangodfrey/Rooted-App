import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { extractMarketLinks } from '@/src/lib/market-links';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/layout';
import type { Event } from '@/src/types/database';

interface MarketLinksProps {
  event: Pick<Event, 'website_url' | 'extra_info' | 'sync_metadata'>;
}

const LINKS = [
  { key: 'website' as const, label: 'Website', icon: 'globe' as const },
  { key: 'facebook' as const, label: 'Facebook', icon: 'facebook' as const },
  { key: 'instagram' as const, label: 'Instagram', icon: 'instagram' as const },
];

export function MarketLinks({ event }: MarketLinksProps) {
  const links = extractMarketLinks(event);
  const items = LINKS.map((item) => {
    const href = links[item.key];
    return href ? { ...item, href } : null;
  }).filter(Boolean) as Array<(typeof LINKS)[number] & { href: string }>;

  if (items.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 12 }}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => Linking.openURL(item.href)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.honeydew,
            borderRadius: radius.button,
            paddingVertical: 8,
            paddingHorizontal: 12,
          }}>
          <FontAwesome name={item.icon} size={14} color={colors.primary} />
          <Text variant="caption" className="ml-2 font-semibold text-primary">
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
