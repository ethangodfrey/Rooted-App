import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';

interface ActionRowProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export function ActionRow({ icon, title, subtitle, onPress }: ActionRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="flex-row items-center px-4 py-3.5">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
          <FontAwesome name={icon} size={18} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1 pr-2">
          <Text variant="body" className="font-semibold">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" className="mt-0.5">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <FontAwesome name="chevron-right" size={14} color={colors.sage} />
      </Card>
    </Pressable>
  );
}
