import { router, useFocusEffect } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ApprovalStatusPill } from '@/src/components/admin/approval-status-pill';
import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { isApplicationReadyForReview } from '@/src/lib/vendor-application';
import {
  isAdminAgentConfigured,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABEL,
  recordVendorReviewFeedback,
  runVendorReviewQueue,
  type VendorReviewSuggestion,
} from '@/src/lib/admin-agent';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/use-auth';
import type { ApprovalStatus, Vendor } from '@/src/types/database';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

type AdminVendorRow = Vendor & {
  users: { email: string | null; name: string | null } | null;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminVendorsScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewingQueue, setReviewingQueue] = useState(false);
  const [suggestionsByVendor, setSuggestionsByVendor] = useState<
    Record<string, VendorReviewSuggestion>
  >({});

  const loadSuggestions = useCallback(async (vendorIds: string[]) => {
    if (vendorIds.length === 0) {
      setSuggestionsByVendor({});
      return;
    }

    const { data } = await supabase
      .from('vendor_review_suggestions')
      .select('id, vendor_id, recommendation, confidence, summary, flags, reasons, agent_version, created_at')
      .in('vendor_id', vendorIds)
      .order('created_at', { ascending: false });

    const map: Record<string, VendorReviewSuggestion> = {};
    for (const row of data ?? []) {
      if (map[row.vendor_id]) continue;
      map[row.vendor_id] = {
        ...row,
        confidence: Number(row.confidence),
        flags: (row.flags as string[]) ?? [],
        reasons: (row.reasons as string[]) ?? [],
      } as VendorReviewSuggestion;
    }
    setSuggestionsByVendor(map);
  }, []);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('vendors')
      .select('*, users!vendors_user_id_fkey(email, name)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('approval_status', filter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setVendors([]);
    } else {
      const rows = (data as AdminVendorRow[]) ?? [];
      setVendors(rows);
      if (filter === 'pending') {
        await loadSuggestions(rows.map((v) => v.id));
      } else {
        setSuggestionsByVendor({});
      }
    }

    setLoading(false);
  }, [filter, loadSuggestions]);

  async function handleRunAiReview() {
    if (!isAdminAgentConfigured()) return;
    setReviewingQueue(true);
    setError(null);
    try {
      await runVendorReviewQueue();
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setReviewingQueue(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadVendors();
    }, [loadVendors]),
  );

  async function setApproval(vendor: AdminVendorRow, status: ApprovalStatus) {
    if (!user) return;

    setActingId(vendor.id);
    setError(null);

    const { error: updateError } = await supabase
      .from('vendors')
      .update({ approval_status: status, updated_at: new Date().toISOString() })
      .eq('id', vendor.id);

    if (updateError) {
      setActingId(null);
      setError(updateError.message);
      return;
    }

    if (status === 'approved' || status === 'rejected') {
      await recordVendorReviewFeedback({
        vendor,
        adminUserId: user.id,
        adminAction: status,
        suggestion: suggestionsByVendor[vendor.id] ?? null,
      });
    }

    setActingId(null);
    await loadVendors();
  }

  const pendingCount = filter === 'pending' ? vendors.length : null;

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-1">
        Vendor approvals
      </Text>
      <Text variant="subtitle" className="mb-6">
        Review storefront applications before they appear to shoppers.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      {filter === 'pending' && isAdminAgentConfigured() ? (
        <View className="mb-4">
          <Button
            label={reviewingQueue ? 'Running AI review…' : 'Run AI review on pending queue'}
            loading={reviewingQueue}
            variant="secondary"
            onPress={handleRunAiReview}
          />
        </View>
      ) : null}

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
          <View className="mt-3">
            <Button label="Retry" variant="secondary" onPress={loadVendors} />
          </View>
        </Card>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <LoadingIndicator />
        </View>
      ) : vendors.length === 0 ? (
        <Card>
          <Text variant="heading" className="mb-1">
            {filter === 'pending' ? 'No pending vendors' : 'No vendors found'}
          </Text>
          <Text variant="caption">
            {filter === 'pending'
              ? 'New vendor signups will appear here for review.'
              : 'Try another filter to see more applications.'}
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          {filter === 'pending' && pendingCount !== null && pendingCount > 0 ? (
            <Text variant="caption" className="text-forest">
              {pendingCount} vendor{pendingCount === 1 ? '' : 's'} awaiting review
            </Text>
          ) : null}

          {vendors.map((vendor) => {
            const isPending = vendor.approval_status === 'pending';
            const isActing = actingId === vendor.id;
            const aiSuggestion = suggestionsByVendor[vendor.id];

            return (
              <Card key={vendor.id}>
                <Pressable onPress={() => router.push(`/(admin)/vendors/${vendor.id}`)}>
                  <View className="mb-3 flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text variant="heading" className="mb-1">
                        {vendor.business_name ?? 'Unnamed business'}
                      </Text>
                      {aiSuggestion ? (
                        <Text
                          className={`mb-1 text-xs font-semibold ${RECOMMENDATION_COLOR[aiSuggestion.recommendation]}`}>
                          AI: {RECOMMENDATION_LABEL[aiSuggestion.recommendation]}
                        </Text>
                      ) : null}
                      <Text variant="caption" className="mb-1">
                        {vendor.users?.email ?? 'No email'}
                      </Text>
                      {vendor.product_summary ? (
                        <Text variant="caption" className="mb-1" numberOfLines={2}>
                          {vendor.product_summary}
                        </Text>
                      ) : null}
                      {vendor.category ? (
                        <Text variant="caption" className="mb-1">
                          {vendor.category}
                        </Text>
                      ) : null}
                      {vendor.sell_city && vendor.sell_state ? (
                        <Text variant="caption">
                          {vendor.sell_city}, {vendor.sell_state}
                        </Text>
                      ) : null}
                    </View>
                    <ApprovalStatusPill status={vendor.approval_status} />
                  </View>
                  {isPending && !isApplicationReadyForReview(vendor) ? (
                    <Text variant="caption" className="mb-2 text-amber-900">
                      Incomplete application
                    </Text>
                  ) : null}
                  <Text variant="caption" className="mb-3">
                    Applied{' '}
                    {formatDate(vendor.application_submitted_at ?? vendor.created_at)}
                  </Text>
                </Pressable>

                {isPending ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        label="Approve"
                        loading={isActing}
                        disabled={!isApplicationReadyForReview(vendor)}
                        onPress={() => setApproval(vendor, 'approved')}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Reject"
                        variant="secondary"
                        loading={isActing}
                        onPress={() => setApproval(vendor, 'rejected')}
                      />
                    </View>
                  </View>
                ) : (
                  <PressableCard onPress={() => router.push(`/(admin)/vendors/${vendor.id}`)}>
                    <Text variant="caption">View details</Text>
                  </PressableCard>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
