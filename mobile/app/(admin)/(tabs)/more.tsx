import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AccountLegalSection } from '@/src/components/account/account-legal-section';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  fetchFeedbackStats,
  isAdminAgentConfigured,
  type FeedbackStats,
} from '@/src/lib/admin-agent';
import {
  fetchPostModerationFeedbackStats,
  isPostModerationConfigured,
  type PostModerationFeedbackStats,
} from '@/src/lib/admin-post-agent';
import { useAuth } from '@/src/hooks/use-auth';

export default function AdminMoreScreen() {
  const { user, signOut } = useAuth();
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [postFeedbackStats, setPostFeedbackStats] = useState<PostModerationFeedbackStats | null>(
    null,
  );

  useEffect(() => {
    if (isAdminAgentConfigured()) {
      fetchFeedbackStats().then(setFeedbackStats);
    }
    if (isPostModerationConfigured()) {
      fetchPostModerationFeedbackStats().then(setPostFeedbackStats);
    }
  }, []);

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-6">
        More
      </Text>

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Email
        </Text>
        <Text variant="body" className="mb-4">
          {user?.email ?? '—'}
        </Text>
        <Text variant="caption" className="mb-1">
          Role
        </Text>
        <Text variant="body" className="capitalize">
          {user?.role ?? '—'}
        </Text>
      </Card>

      {isAdminAgentConfigured() && feedbackStats && feedbackStats.total > 0 ? (
        <Card className="mb-4">
          <Text variant="heading" className="mb-2">
            AI training feedback
          </Text>
          <Text variant="caption" className="mb-1">
            {feedbackStats.total} decisions recorded
          </Text>
          <Text variant="caption" className="mb-1 text-forest">
            {feedbackStats.accepted} matched AI suggestion
          </Text>
          <Text variant="caption" className="text-warn">
            {feedbackStats.overridden} overrode AI suggestion
          </Text>
        </Card>
      ) : null}

      {isPostModerationConfigured() && postFeedbackStats && postFeedbackStats.total > 0 ? (
        <Card className="mb-4">
          <Text variant="heading" className="mb-2">
            Post moderation training
          </Text>
          <Text variant="caption" className="mb-1">
            {postFeedbackStats.total} moderation decisions recorded
          </Text>
          <Text variant="caption" className="mb-1 text-forest">
            {postFeedbackStats.accepted} matched AI suggestion
          </Text>
          <Text variant="caption" className="text-warn">
            {postFeedbackStats.overridden} overrode AI suggestion
          </Text>
        </Card>
      ) : null}

      <Card className="mb-4">
        <Text variant="heading" className="mb-1">
          Pilot admin tools
        </Text>
        <Text variant="caption">
          Vendor approvals, post moderation, event management, and order oversight are in the admin
          tabs. Your decisions train the AI admin over time.
        </Text>
      </Card>

      <View className="mt-2">
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>

      <AccountLegalSection onAccountDeleted={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}
