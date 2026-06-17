import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';

/**
 * Reads and mutates the signed-in shopper's `saved_vendors` array.
 * Applies optimistic updates and reverts on failure.
 */
export function useSavedVendors() {
  const { user, shopper, refreshUser } = useAuth();
  const [saved, setSaved] = useState<string[]>(shopper?.saved_vendors ?? []);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSaved(shopper?.saved_vendors ?? []);
  }, [shopper?.saved_vendors]);

  const isSaved = useCallback((vendorId: string) => saved.includes(vendorId), [saved]);

  const toggle = useCallback(
    async (vendorId: string) => {
      if (!user) return;
      const previous = saved;
      const next = previous.includes(vendorId)
        ? previous.filter((id) => id !== vendorId)
        : [...previous, vendorId];

      setSaved(next);
      setPending(true);
      const { error } = await supabase
        .from('shoppers')
        .update({ saved_vendors: next })
        .eq('user_id', user.id);
      setPending(false);

      if (error) {
        setSaved(previous);
        return;
      }
      await refreshUser();
    },
    [saved, user, refreshUser],
  );

  const remove = useCallback(
    async (vendorId: string) => {
      if (!saved.includes(vendorId)) return;
      await toggle(vendorId);
    },
    [saved, toggle],
  );

  return { saved, isSaved, toggle, remove, pending };
}
