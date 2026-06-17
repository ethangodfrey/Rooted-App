import { FontAwesome } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import {
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABEL,
  type VendorReviewSuggestion,
} from '@/src/lib/admin-agent';

interface AiReviewSuggestionCardProps {
  suggestion: VendorReviewSuggestion | null;
  loading?: boolean;
  reviewing?: boolean;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

export function AiReviewSuggestionCard({
  suggestion,
  loading = false,
  reviewing = false,
  onRefresh,
  showRefresh = false,
}: AiReviewSuggestionCardProps) {
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
          <FontAwesome name="magic" size={14} color="#228B22" />
          <Text variant="heading" className="ml-2 mb-0">
            AI review
          </Text>
        </View>
        <Text variant="caption" className="mb-3">
          No AI suggestion yet. Run a review to get a recommendation before you approve or reject.
        </Text>
        {showRefresh && onRefresh ? (
          <Button label="Run AI review" loading={reviewing} onPress={onRefresh} variant="secondary" />
        ) : null}
      </Card>
    );
  }

  const confidencePct = Math.round(suggestion.confidence * 100);

  return (
    <Card className="mb-4 bg-forest-50">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FontAwesome name="magic" size={14} color="#228B22" />
          <Text variant="heading" className="ml-2 mb-0">
            AI review
          </Text>
        </View>
        <Text className={`text-xs font-semibold ${RECOMMENDATION_COLOR[suggestion.recommendation]}`}>
          {RECOMMENDATION_LABEL[suggestion.recommendation]} · {confidencePct}%
        </Text>
      </View>

      <Text variant="body" className="mb-3">
        {suggestion.summary}
      </Text>

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
        Suggestion only — you still make the final approve/reject decision.
      </Text>

      {showRefresh && onRefresh ? (
        <View className="mt-3">
          <Button
            label="Refresh AI review"
            loading={reviewing}
            onPress={onRefresh}
            variant="ghost"
          />
        </View>
      ) : null}
    </Card>
  );
}
