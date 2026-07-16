import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { UserSticker, type StickerRole } from '@/src/components/ui/UserSticker';
import type { UserRole } from '@/src/types/database';

export type ChatThreadProps = {
  title: string;
  role?: UserRole | StickerRole | null;
  subtitle?: string | null;
  children?: ReactNode;
  emptyLabel?: string;
};

/** Chat thread header with plain-text role sticker (no emojis). */
export function ChatThread({
  title,
  role,
  subtitle,
  children,
  emptyLabel = 'No messages yet.',
}: ChatThreadProps) {
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1228]">
      <View className="flex-row items-center gap-2 border-b border-white/10 bg-[#121A36]/E0 px-4 py-3">
        <Text className="min-w-0 flex-1 text-base font-semibold text-slate-50" numberOfLines={1}>
          {title}
        </Text>
        <UserSticker role={role} />
      </View>
      {subtitle ? (
        <Text className="border-b border-white/10 px-4 py-2 text-xs text-slate-400">
          {subtitle}
        </Text>
      ) : null}
      <View className="flex-1 px-4 py-4">
        {children ?? <Text className="text-sm text-slate-400">{emptyLabel}</Text>}
      </View>
    </View>
  );
}
