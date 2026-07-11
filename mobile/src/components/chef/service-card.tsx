import { Pressable } from 'react-native';

import { PressableCard } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { chefServiceTypeLabel, formatCents } from '@/src/lib/role-utils';
import type { ChefService } from '@/src/types/database';

interface ServiceCardProps {
  service: ChefService;
  onPress?: () => void;
}

export function ServiceCard({ service, onPress }: ServiceCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="mb-3" disabled={!onPress}>
      <PressableCard>
        <Text variant="heading" className="mb-1">
          {service.service_name}
        </Text>
        <Text variant="caption" className="mb-1">
          {chefServiceTypeLabel(service.service_type)} · {formatCents(service.base_price)}
        </Text>
        {service.description ? (
          <Text variant="body" numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
      </PressableCard>
    </Pressable>
  );
}
