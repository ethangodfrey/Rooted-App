import { Pressable } from 'react-native';

import { PressableCard } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { vendorTypeLabel } from '@/src/lib/role-utils';
import type { Vendor } from '@/src/types/database';

interface VendorCardProps {
  vendor: Pick<Vendor, 'id' | 'business_name' | 'category'> & {
    vendor_type?: string | null;
    business_description?: string | null;
  };
  onPress: () => void;
}

export function VendorCard({ vendor, onPress }: VendorCardProps) {
  const typeLabel = vendorTypeLabel(vendor.vendor_type);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="mb-3">
      <PressableCard>
        <Text variant="heading" className="mb-1">
          {vendor.business_name ?? 'Vendor'}
        </Text>
        {typeLabel ? (
          <Text variant="caption" className="mb-1">
            {typeLabel}
          </Text>
        ) : null}
        {vendor.category ? (
          <Text variant="caption" className="mb-1">
            {vendor.category}
          </Text>
        ) : null}
        {vendor.business_description ? (
          <Text variant="body" numberOfLines={2}>
            {vendor.business_description}
          </Text>
        ) : null}
      </PressableCard>
    </Pressable>
  );
}
