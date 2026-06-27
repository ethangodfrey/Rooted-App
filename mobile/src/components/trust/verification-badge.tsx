import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';

const BADGE_LABELS: Record<string, string> = {
  identity_verified: 'Verified ID',
  food_safety_certified: 'Food Safety',
  top_rated: 'Top Rated',
  quick_responder: 'Quick Responder',
  established_seller: 'Established',
  superhost: 'Super Chef',
  market_regular: 'Market Regular',
};

interface VerificationBadgeProps {
  badgeType: string;
  compact?: boolean;
}

export function VerificationBadge({ badgeType, compact }: VerificationBadgeProps) {
  const label = BADGE_LABELS[badgeType] ?? badgeType.replace(/_/g, ' ');

  return (
    <View className={`flex-row items-center rounded-full bg-cream px-2 ${compact ? 'py-0.5' : 'py-1'}`}>
      <FontAwesome name="check-circle" size={compact ? 12 : 14} color={colors.accent} />
      <Text variant="caption" className="ml-1 font-semibold text-forest-700">
        {label}
      </Text>
    </View>
  );
}

interface BadgeRowProps {
  badgeTypes: string[];
  compact?: boolean;
}

export function BadgeRow({ badgeTypes, compact }: BadgeRowProps) {
  if (!badgeTypes.length) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {badgeTypes.map((type) => (
        <VerificationBadge key={type} badgeType={type} compact={compact} />
      ))}
    </View>
  );
}
