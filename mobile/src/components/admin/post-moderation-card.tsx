import { FontAwesome } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import {
  MODERATION_RECOMMENDATION_COLOR,
  MODERATION_RECOMMENDATION_LABEL,
  type PostModerationSuggestion,
} from '@/src/lib/admin-post-agent';

interface PostModerationCardProps {
  suggestion: PostModerationSuggestion | null;
  loading?: boolean;
  reviewing?: boolean;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

export function PostModerationCard({
  suggestion,
  loading = false,
  reviewing = false,
  onRefresh,
  showRefresh = false,
}: PostModerationCardProps) {
  if (loading) {
    return (
      <Card className="mb-4 bg-forest-50">
        <View className="items-center py-4">
          <LoadingIndicator />
        </View>
      </Card>
    );
  }

  if (!suggestion) {
    return (
      <Card className="mb-4 bg-forest-50">
        <View className="mb-2 flex-row items-center">
          <FontAwesome name="shield" size={14} color="#228B22" />
          <Text variant="heading" className="ml-2 mb-0">
            AI moderation
          </Text>
        </View>
        <Text variant="caption" className="mb-3">
          No AI scan yet. Run moderation to check caption and media for inappropriate content.
        </Text>
        {showRefresh && onRefresh ? (
          <Button label="Scan post" loading={reviewing} onPress={onRefresh} variant="secondary" />
        ) : null}
      </Card>
    );
  }

  const confidencePct = Math.round(suggestion.confidence * 100);

  return (
    <Card className="mb-4 bg-forest-50">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FontAwesome name="shield" size={14} color="#228B22" />
          <Text variant="heading" className="ml-2 mb-0">
            AI moderation
          </Text>
        </View>
        <Text
          className={`text-xs font-semibold ${MODERATION_RECOMMENDATION_COLOR[suggestion.recommendation]}`}>
          {MODERATION_RECOMMENDATION_LABEL[suggestion.recommendation]} · {confidencePct}%
        </Text>
      </View>

      <Text variant="body" className="mb-2">
        {suggestion.summary}
      </Text>

      {suggestion.categories.length > 0 && suggestion.categories[0] !== 'none' ? (
        <Text variant="caption" className="mb-2 text-warn">
          Categories: {suggestion.categories.filter((c) => c !== 'none').join(', ')}
        </Text>
      ) : null}

      {suggestion.reasons.length > 0 ? (
        <View className="mb-3">
          {suggestion.reasons.map((reason) => (
            <Text key={reason} variant="caption" className="mb-1">
              • {reason}
            </Text>
          ))}
        </View>
      ) : null}

      <Text variant="caption" className="text-ink/70">
        Suggestion only — you decide whether to approve, flag, or remove.
      </Text>

      {showRefresh && onRefresh ? (
        <View className="mt-3">
          <Button label="Re-scan" loading={reviewing} onPress={onRefresh} variant="ghost" />
        </View>
      ) : null}
    </Card>
  );
}
