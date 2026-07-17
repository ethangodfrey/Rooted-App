import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { UserRole } from '@/src/types/database';
import type { ProfileRole } from '@/src/types/profiles';

export type StickerRole = ProfileRole;

type UserStickerProps = {
  role: UserRole | StickerRole | null | undefined;
  style?: StyleProp<ViewStyle>;
};

export function resolveStickerRole(
  role: UserRole | StickerRole | null | undefined,
): StickerRole | null {
  if (role === 'vendor') return 'vendor';
  if (role === 'farmer') return 'farmer';
  if (role === 'shopper' || role === 'customer') return 'shopper';
  return null;
}

const TONES: Record<StickerRole, { color: string; background: string; border: string }> = {
  shopper: {
    color: '#c7d2fe',
    background: 'rgba(99, 102, 241, 0.16)',
    border: 'rgba(129, 140, 248, 0.45)',
  },
  vendor: {
    color: '#fdba74',
    background: 'rgba(249, 115, 22, 0.16)',
    border: 'rgba(251, 146, 60, 0.5)',
  },
  farmer: {
    color: '#86efac',
    background: 'rgba(34, 197, 94, 0.16)',
    border: 'rgba(74, 222, 128, 0.5)',
  },
};

const LABELS: Record<StickerRole, string> = {
  shopper: 'SHOPPER',
  vendor: 'VENDOR',
  farmer: 'FARMER',
};

/** Minimalist role sticker — uppercase text only, no emojis. */
export function UserSticker({ role, style }: UserStickerProps) {
  const sticker = resolveStickerRole(role);
  if (!sticker) return null;

  const label = LABELS[sticker];
  const tone = TONES[sticker];

  return (
    <View
      accessibilityLabel={`${label} role`}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tone.border,
          backgroundColor: tone.background,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: tone.color,
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
