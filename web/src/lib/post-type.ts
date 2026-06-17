import type { PostType } from '@/types/database';

export const POST_TYPE_LABEL: Record<PostType, string> = {
  update: 'Update',
  product: 'Product',
  event: 'Event',
  promo: 'Promo',
};

export const POST_TYPE_ICON: Record<PostType, string> = {
  update: '📣',
  product: '🛍️',
  event: '📅',
  promo: '✨',
};
