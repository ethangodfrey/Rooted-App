import { useCallback } from 'react';

import { useSavedItems } from '@/src/hooks/use-saved-items';

/**
 * Vendor-specific wrapper around unified `saved_items`.
 * Keeps legacy call sites working while persisting to saved_items.
 */
export function useSavedVendors() {
  const { savedVendorIds, isSaved, toggle, pending, refresh } = useSavedItems();

  const isSavedVendor = useCallback((vendorId: string) => isSaved('vendor', vendorId), [isSaved]);

  const toggleVendor = useCallback(
    async (vendorId: string) => {
      await toggle({ itemType: 'vendor', itemId: vendorId });
    },
    [toggle],
  );

  const remove = useCallback(
    async (vendorId: string) => {
      if (!isSavedVendor(vendorId)) return;
      await toggleVendor(vendorId);
    },
    [isSavedVendor, toggleVendor],
  );

  return {
    saved: savedVendorIds,
    isSaved: isSavedVendor,
    toggle: toggleVendor,
    remove,
    pending,
    refresh,
  };
}
