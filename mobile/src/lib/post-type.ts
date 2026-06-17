import type { FontAwesome } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { PostType } from '@/src/types/database';

type IconName = ComponentProps<typeof FontAwesome>['name'];

export const POST_TYPES: PostType[] = ['announcement', 'promotion', 'launch', 'restock'];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  announcement: 'Announcement',
  promotion: 'Promotion',
  launch: 'Launch',
  restock: 'Restock',
};

export const POST_TYPE_ICON: Record<PostType, IconName> = {
  announcement: 'bullhorn',
  promotion: 'tag',
  launch: 'rocket',
  restock: 'refresh',
};
