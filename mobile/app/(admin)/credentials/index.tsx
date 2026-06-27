import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { TextArea } from '@/src/components/ui/text-area';
import { useAuth } from '@/src/hooks/use-auth';
import {
  approveCredential,
  CREDENTIAL_LABELS,
  fetchCredentialsForReview,
  rejectCredential,
  resolveCredentialDocumentUrl,
  type AdminCredentialRow,
} from '@/src/lib/verification';

type Filter = 'pending' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminCredentialsScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<AdminCredentialRow[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCredentialsForReview(filter);
      setRows(data);
      const entries = await Promise.all(
        data.map(async (row) => {
          const url = await resolveCredentialDocumentUrl(row.document_url);
          return [row.id, url] as const;
        }),
      );
      const map: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) map[id] = url;
      }
      setDocUrls(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credentials.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleApprove(row: AdminCredentialRow) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await approveCredential(row, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve credential.');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(row: AdminCredentialRow) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await rejectCredential(row.id, user.id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject credential.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-1">
        Credential review
      </Text>
      <Text variant="subtitle" className="mb-6">
        Verify vendor and chef documents. Approving awards the matching trust badge.
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

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
          <View className="mt-3">
            <Button label="Retry" variant="secondary" onPress={load} />
          </View>
        </Card>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <LoadingIndicator />
        </View>
      ) : rows.length === 0 ? (
        <Card>
          <Text variant="heading" className="mb-1">
            {filter === 'pending' ? 'No pending credentials' : 'No credentials found'}
          </Text>
          <Text variant="caption">
            {filter === 'pending'
              ? 'New document submissions will appear here for review.'
              : 'Try the pending filter to focus on the review queue.'}
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          {rows.map((row) => {
            const isActing = actingId === row.id;
            const isRejecting = rejectingId === row.id;
            const isPending = row.verification_status === 'pending';

            return (
              <Card key={row.id}>
                <View className="mb-2 flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="heading" className="mb-1">
                      {CREDENTIAL_LABELS[row.credential_type] ?? row.credential_type}
                    </Text>
                    <Text variant="caption">
                      {row.users?.name ?? 'Unknown'} · {row.users?.role ?? '—'}
                    </Text>
                    <Text variant="caption">{row.users?.email ?? 'No email'}</Text>
                  </View>
                  <Text variant="caption" className="font-semibold">
                    {STATUS_LABEL[row.verification_status] ?? row.verification_status}
                  </Text>
                </View>

                {docUrls[row.id] ? (
                  <Image
                    source={{ uri: docUrls[row.id] }}
                    className="mb-3 h-48 w-full rounded-xl bg-line"
                    resizeMode="cover"
                  />
                ) : (
                  <Text variant="caption" className="mb-3 text-muted">
                    No document attached.
                  </Text>
                )}

                {row.issuing_authority ? (
                  <Text variant="caption">Issued by: {row.issuing_authority}</Text>
                ) : null}
                {row.credential_number ? (
                  <Text variant="caption">Number: {row.credential_number}</Text>
                ) : null}
                {row.issue_date ? (
                  <Text variant="caption">Issued: {row.issue_date}</Text>
                ) : null}
                {row.expiry_date ? (
                  <Text variant="caption">Expires: {row.expiry_date}</Text>
                ) : null}
                {row.verification_status === 'rejected' && row.rejection_reason ? (
                  <Text variant="caption" className="mt-1 text-danger">
                    Reason: {row.rejection_reason}
                  </Text>
                ) : null}
                <Text variant="caption" className="mt-1">
                  Submitted {formatDate(row.created_at)}
                </Text>

                {isPending ? (
                  isRejecting ? (
                    <View className="mt-3">
                      <TextArea
                        label="Rejection reason (optional)"
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Let the submitter know what to fix…"
                        minHeight={72}
                      />
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <Button
                            label="Confirm reject"
                            loading={isActing}
                            onPress={() => handleReject(row)}
                          />
                        </View>
                        <View className="flex-1">
                          <Button
                            label="Cancel"
                            variant="ghost"
                            onPress={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="mt-3 flex-row gap-3">
                      <View className="flex-1">
                        <Button
                          label="Approve"
                          loading={isActing}
                          onPress={() => handleApprove(row)}
                        />
                      </View>
                      <View className="flex-1">
                        <Button
                          label="Reject"
                          variant="secondary"
                          onPress={() => {
                            setRejectingId(row.id);
                            setRejectReason('');
                          }}
                        />
                      </View>
                    </View>
                  )
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
