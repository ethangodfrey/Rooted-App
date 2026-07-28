import { VendorB2bChatPage } from '@/pages/vendor/VendorB2bChatPage';

/** Creator-shell B2B chat — returns to `/creator/inbox`. */
export function CreatorB2bChatPage() {
  return (
    <VendorB2bChatPage backTo="/creator/inbox" subtitle="Creator network thread" />
  );
}
