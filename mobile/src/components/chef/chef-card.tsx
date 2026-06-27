import { Pressable, View } from 'react-native';

import { PressableCard } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import type { Chef } from '@/src/types/database';

interface ChefCardProps {
  chef: Pick<
    Chef,
    'id' | 'display_name' | 'home_base_city' | 'home_base_state'
  > & {
    bio?: string | null;
    cuisine_specialties?: string[];
    rating_average?: number | null;
  };
  onPress: () => void;
}

export function ChefCard({ chef, onPress }: ChefCardProps) {
  const location = [chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ');

  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="mb-3">
      <PressableCard>
        <Text variant="heading" className="mb-1">
          {chef.display_name}
        </Text>
        {location ? (
          <Text variant="caption" className="mb-1">
            {location}
          </Text>
        ) : null}
        {chef.cuisine_specialties?.length ? (
          <Text variant="caption" className="mb-1">
            {chef.cuisine_specialties.slice(0, 3).join(' · ')}
          </Text>
        ) : null}
        {chef.bio ? (
          <Text variant="body" numberOfLines={2}>
            {chef.bio}
          </Text>
        ) : null}
        {chef.rating_average ? (
          <Text variant="caption" className="mt-2">
            ★ {chef.rating_average.toFixed(1)}
          </Text>
        ) : null}
      </PressableCard>
    </Pressable>
  );
}
