import { FontAwesome } from '@expo/vector-icons';
import { View } from 'react-native';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';

interface PlaceholderScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  phase?: string;
}

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  icon = 'leaf',
  phase,
}: PlaceholderScreenProps) {
  return (
    <Screen centered>
      <View className="items-center">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-card bg-honeydew">
          <FontAwesome name={icon} size={28} color={colors.primary} />
        </View>
        <Text variant="eyebrow" className="mb-2 text-center">
          {eyebrow}
        </Text>
        <Text variant="title" className="mb-2 text-center">
          {title}
        </Text>
        <Text variant="subtitle" className="text-center">
          {description}
        </Text>
        {phase ? (
          <View className="mt-6 rounded-full bg-honeydew px-4 py-2">
            <Text className="text-sm font-medium text-primary">{phase}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
