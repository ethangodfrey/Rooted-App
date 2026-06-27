import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { SavedItem, SavedItemType } from '@/src/types/database';

export type SavedItemRef =
  | { itemType: 'vendor'; itemId: string }
  | { itemType: 'chef'; itemId: string }
  | { itemType: 'product'; itemId: string }
  | { itemType: 'service'; itemId: string }
  | { itemType: 'event'; itemId: string };

function refColumn(ref: SavedItemRef): { column: keyof SavedItem; value: string } {
  switch (ref.itemType) {
    case 'vendor':
      return { column: 'vendor_id', value: ref.itemId };
    case 'chef':
      return { column: 'chef_id', value: ref.itemId };
    case 'product':
      return { column: 'product_id', value: ref.itemId };
    case 'service':
      return { column: 'service_id', value: ref.itemId };
    case 'event':
      return { column: 'event_id', value: ref.itemId };
  }
}

function itemIdFromRow(row: SavedItem): string | null {
  switch (row.item_type) {
    case 'vendor':
      return row.vendor_id;
    case 'chef':
      return row.chef_id;
    case 'product':
      return row.product_id;
    case 'service':
      return row.service_id;
    case 'event':
      return row.event_id;
    default:
      return null;
  }
}

/**
 * Reads and mutates the signed-in customer's `saved_items` rows.
 */
export function useSavedItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoaded(true);
      return;
    }

    const { data } = await supabase
      .from('saved_items')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    setItems((data ?? []) as SavedItem[]);
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isSaved = useCallback(
    (itemType: SavedItemType, itemId: string) =>
      items.some((row) => row.item_type === itemType && itemIdFromRow(row) === itemId),
    [items],
  );

  const toggle = useCallback(
    async (ref: SavedItemRef) => {
      if (!user?.id) return;
      const { column, value } = refColumn(ref);
      const existing = items.find(
        (row) => row.item_type === ref.itemType && itemIdFromRow(row) === ref.itemId,
      );

      setPending(true);
      if (existing) {
        const previous = items;
        setItems((current) => current.filter((row) => row.id !== existing.id));
        const { error } = await supabase.from('saved_items').delete().eq('id', existing.id);
        setPending(false);
        if (error) {
          setItems(previous);
        }
        return;
      }

      const optimistic: SavedItem = {
        id: `temp-${ref.itemType}-${ref.itemId}`,
        customer_id: user.id,
        item_type: ref.itemType,
        vendor_id: ref.itemType === 'vendor' ? ref.itemId : null,
        chef_id: ref.itemType === 'chef' ? ref.itemId : null,
        product_id: ref.itemType === 'product' ? ref.itemId : null,
        service_id: ref.itemType === 'service' ? ref.itemId : null,
        event_id: ref.itemType === 'event' ? ref.itemId : null,
        created_at: new Date().toISOString(),
      };
      const previous = items;
      setItems((current) => [optimistic, ...current]);

      const insertRow: Record<string, string> = {
        customer_id: user.id,
        item_type: ref.itemType,
        [column]: value,
      };

      const { data, error } = await supabase
        .from('saved_items')
        .insert(insertRow)
        .select('*')
        .maybeSingle();

      setPending(false);
      if (error || !data) {
        setItems(previous);
        return;
      }

      setItems((current) =>
        current.map((row) => (row.id === optimistic.id ? (data as SavedItem) : row)),
      );
    },
    [items, user?.id],
  );

  const idsForType = useCallback(
    (itemType: SavedItemType) =>
      items
        .filter((row) => row.item_type === itemType)
        .map((row) => itemIdFromRow(row))
        .filter((id): id is string => Boolean(id)),
    [items],
  );

  // Memoize derived id arrays so their references stay stable across renders
  // when `items` is unchanged. Returning fresh arrays each render causes
  // infinite update loops in consumers that depend on them in effects.
  const savedVendorIds = useMemo(() => idsForType('vendor'), [idsForType]);
  const savedChefIds = useMemo(() => idsForType('chef'), [idsForType]);
  const savedProductIds = useMemo(() => idsForType('product'), [idsForType]);
  const savedServiceIds = useMemo(() => idsForType('service'), [idsForType]);
  const savedEventIds = useMemo(() => idsForType('event'), [idsForType]);

  return {
    items,
    loaded,
    pending,
    isSaved,
    toggle,
    refresh,
    savedVendorIds,
    savedChefIds,
    savedProductIds,
    savedEventIds,
    savedServiceIds,
  };
}
