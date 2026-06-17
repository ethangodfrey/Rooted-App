import { router, useLocalSearchParams } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApprovalStatusPill } from '@/src/components/admin/approval-status-pill';
import { AiReviewSuggestionCard } from '@/src/components/admin/ai-review-suggestion';
import { VerificationCues } from '@/src/components/admin/verification-cues';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { isApplicationReadyForReview } from '@/src/lib/vendor-application';
import {
  isAdminAgentConfigured,
  recordVendorReviewFeedback,
  reviewVendorWithAi,
  type VendorReviewSuggestion,
} from '@/src/lib/admin-agent';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/use-auth';
import type { ApprovalStatus, Vendor } from '@/src/types/database';

type AdminVendorRow = Vendor & {
  users: { email: string | null; name: string | null } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminVendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<AdminVendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [suggestion, setSuggestion] = useState<VendorReviewSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const loadSuggestion = useCallback(async () => {
    if (!id) return;
    setSuggestionLoading(true);
    const { data } = await supabase
      .from('vendor_review_suggestions')
      .select('id, vendor_id, recommendation, confidence, summary, flags, reasons, agent_version, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSuggestion({
        ...data,
        confidence: Number(data.confidence),
        flags: (data.flags as string[]) ?? [],
        reasons: (data.reasons as string[]) ?? [],
      } as VendorReviewSuggestion);
    } else {
      setSuggestion(null);
    }
    setSuggestionLoading(false);
  }, [id]);

  const loadVendor = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('vendors')
      .select('*, users!vendors_user_id_fkey(email, name)')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setVendor(null);
    } else if (!data) {
      setError('Vendor not found.');
      setVendor(null);
    } else {
      setVendor(data as AdminVendorRow);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadVendor();
    loadSuggestion();
  }, [loadVendor, loadSuggestion]);

  async function handleAiReview() {
    if (!id || !isAdminAgentConfigured()) return;
    setReviewing(true);
    setError(null);
    try {
      const result = await reviewVendorWithAi(id);
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setReviewing(false);
    }
  }

  async function setApproval(status: ApprovalStatus) {
    if (!vendor || !user) return;

    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('vendors')
      .update({ approval_status: status, updated_at: new Date().toISOString() })
      .eq('id', vendor.id);

    if (updateError) {
      setActing(false);
      setError(updateError.message);
      return;
    }

    if (status === 'approved' || status === 'rejected') {
      await recordVendorReviewFeedback({
        vendor,
        adminUserId: user.id,
        adminAction: status,
        suggestion,
      });
    }

    setActing(false);
    await loadVendor();
  }

  if (loading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!vendor) {
    return (
      <Screen scroll>
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error ?? 'Vendor not found.'}
          </Text>
        </Card>
        <Button label="Back to list" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const ready = isApplicationReadyForReview(vendor);

  return (
    <Screen scroll>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text variant="title" className="mb-0 flex-1">
          {vendor.business_name ?? 'Unnamed business'}
        </Text>
        <ApprovalStatusPill status={vendor.approval_status} />
      </View>

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
        </Card>
      ) : null}

      <VerificationCues vendor={vendor} />

      {isAdminAgentConfigured() ? (
        <AiReviewSuggestionCard
          suggestion={suggestion}
          loading={suggestionLoading}
          reviewing={reviewing}
          showRefresh
          onRefresh={handleAiReview}
        />
      ) : null}

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Contact
        </Text>
        <Text variant="body" className="mb-3">
          {vendor.users?.email ?? '—'}
        </Text>
        {vendor.users?.name ? (
          <>
            <Text variant="caption" className="mb-1">
              Name
            </Text>
            <Text variant="body" className="mb-3">
              {vendor.users.name}
            </Text>
          </>
        ) : null}
        <Text variant="caption" className="mb-1">
          Applied
        </Text>
        <Text variant="body">
          {vendor.application_submitted_at
            ? formatDate(vendor.application_submitted_at)
            : formatDate(vendor.created_at)}
        </Text>
      </Card>

      <Card className="mb-4">
        <Text variant="heading" className="mb-3">
          What they sell
        </Text>
        <Text variant="caption" className="mb-1">
          Category
        </Text>
        <Text variant="body" className="mb-3">
          {vendor.category ?? '—'}
        </Text>
        <Text variant="caption" className="mb-1">
          Product summary
        </Text>
        <Text variant="body" className="mb-3">
          {vendor.product_summary ?? '—'}
        </Text>
        {vendor.business_description ? (
          <>
            <Text variant="caption" className="mb-1">
              Details
            </Text>
            <Text variant="body">{vendor.business_description}</Text>
          </>
        ) : null}
      </Card>

      <Card className="mb-4">
        <Text variant="heading" className="mb-3">
          Where they sell
        </Text>
        <Text variant="caption" className="mb-1">
          Base location
        </Text>
        <Text variant="body" className="mb-3">
          {vendor.sell_city && vendor.sell_state
            ? `${vendor.sell_city}, ${vendor.sell_state}`
            : '—'}
        </Text>
        <Text variant="caption" className="mb-1">
          Channels
        </Text>
        <Text variant="body" className="mb-3">
          {vendor.selling_channels?.length
            ? vendor.selling_channels.join(', ')
            : '—'}
        </Text>
        {vendor.primary_market ? (
          <>
            <Text variant="caption" className="mb-1">
              Main market / event
            </Text>
            <Text variant="body">{vendor.primary_market}</Text>
          </>
        ) : null}
      </Card>

      {vendor.approval_status === 'pending' ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label="Approve"
              loading={acting}
              disabled={!ready}
              onPress={() => setApproval('approved')}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Reject"
              variant="secondary"
              loading={acting}
              onPress={() => setApproval('rejected')}
            />
          </View>
        </View>
      ) : (
        <View className="gap-3">
          {vendor.approval_status !== 'approved' ? (
            <Button
              label="Approve"
              loading={acting}
              disabled={!ready}
              onPress={() => setApproval('approved')}
            />
          ) : null}
          {vendor.approval_status !== 'rejected' ? (
            <Button
              label="Reject"
              variant="secondary"
              loading={acting}
              onPress={() => setApproval('rejected')}
            />
          ) : null}
        </View>
      )}

      {vendor.approval_status === 'pending' && !ready ? (
        <Text variant="caption" className="mt-3 text-center text-amber-900">
          Approve is disabled until the application is complete.
        </Text>
      ) : null}
    </Screen>
  );
}
