import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Input } from '@/src/components/ui/input';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';
import {
  CREDENTIAL_LABELS,
  CREDENTIAL_TYPE_OPTIONS,
  deletePendingCredential,
  fetchCredentials,
  pickAndUploadCredentialDocument,
  resolveCredentialDocumentUrl,
  submitCredential,
} from '@/src/lib/verification';
import type { CredentialType, VerificationCredential, VerificationStatus } from '@/src/types/database';

const STATUS_META: Record<VerificationStatus, { label: string; color: string }> = {
  pending: { label: 'Pending review', color: '#B45309' },
  verified: { label: 'Verified', color: colors.accent },
  rejected: { label: 'Rejected', color: '#B91C1C' },
  expired: { label: 'Expired', color: colors.muted },
};

function StatusPill({ status }: { status: VerificationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: `${meta.color}22` }}>
      <Text variant="caption" style={{ color: meta.color, fontWeight: '600' }}>
        {meta.label}
      </Text>
    </View>
  );
}

interface CredentialManagerProps {
  userId: string;
}

export function CredentialManager({ userId }: CredentialManagerProps) {
  const [credentials, setCredentials] = useState<VerificationCredential[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [credentialType, setCredentialType] = useState<CredentialType>(
    CREDENTIAL_TYPE_OPTIONS[0].value,
  );
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [credentialNumber, setCredentialNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchCredentials(userId);
      setCredentials(rows);
      const entries = await Promise.all(
        rows.map(async (row) => {
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
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setCredentialType(CREDENTIAL_TYPE_OPTIONS[0].value);
    setIssuingAuthority('');
    setCredentialNumber('');
    setIssueDate('');
    setExpiryDate('');
    setDocumentPath(null);
    setDocumentPreview(null);
  }

  async function handleUpload() {
    setError(null);
    setUploading(true);
    try {
      const path = await pickAndUploadCredentialDocument(userId, credentialType);
      if (path) {
        setDocumentPath(path);
        setDocumentPreview(await resolveCredentialDocumentUrl(path));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!documentPath) {
      setError('Upload a photo of the document before submitting.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitCredential({
        userId,
        credentialType,
        documentPath,
        issuingAuthority,
        credentialNumber,
        issueDate,
        expiryDate,
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit credential.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(credential: VerificationCredential) {
    Alert.alert('Remove credential', 'Delete this submission and its document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePendingCredential(credential);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete credential.');
          }
        },
      },
    ]);
  }

  const selectedHint = CREDENTIAL_TYPE_OPTIONS.find((o) => o.value === credentialType)?.hint;

  return (
    <View>
      <Card className="mb-6">
        <Text variant="heading" className="mb-1">
          Submit a credential
        </Text>
        <Text variant="caption" className="mb-3">
          Upload a clear photo. An admin reviews it before it appears as a trust badge.
        </Text>

        <Text variant="body" className="mb-2 font-semibold">
          Credential type
        </Text>
        <View className="mb-1 flex-row flex-wrap gap-2">
          {CREDENTIAL_TYPE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={credentialType === option.value}
              onPress={() => setCredentialType(option.value)}
            />
          ))}
        </View>
        {selectedHint ? (
          <Text variant="caption" className="mb-4">
            {selectedHint}
          </Text>
        ) : null}

        <Text variant="body" className="mb-2 font-semibold">
          Document photo
        </Text>
        <View className="mb-4 flex-row items-center gap-3">
          {documentPreview ? (
            <View className="relative">
              <Image source={{ uri: documentPreview }} className="h-24 w-24 rounded-xl bg-line" />
              <Pressable
                onPress={() => {
                  setDocumentPath(null);
                  setDocumentPreview(null);
                }}
                className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink"
                accessibilityLabel="Remove document">
                <FontAwesome name="times" size={12} color="#ffffff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleUpload}
              disabled={uploading}
              className="h-24 w-24 items-center justify-center rounded-xl border border-dashed border-subtle bg-white">
              {uploading ? (
                <LoadingIndicator />
              ) : (
                <FontAwesome name="camera" size={20} color={colors.primary} />
              )}
            </Pressable>
          )}
          <Text variant="caption" className="flex-1">
            JPG or PNG photo of the certificate, permit, or card.
          </Text>
        </View>

        <Input
          label="Issuing authority (optional)"
          value={issuingAuthority}
          onChangeText={setIssuingAuthority}
          placeholder="e.g. Texas DSHS"
          autoCapitalize="words"
        />
        <Input
          label="Credential number (optional)"
          value={credentialNumber}
          onChangeText={setCredentialNumber}
          placeholder="e.g. CF-123456"
          autoCapitalize="characters"
        />
        <Input
          label="Issue date (optional)"
          value={issueDate}
          onChangeText={setIssueDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Input
          label="Expiry date (optional)"
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

        <Button label="Submit for review" loading={submitting} onPress={handleSubmit} />
      </Card>

      <Text variant="heading" className="mb-3">
        Your credentials
      </Text>

      {loading ? (
        <LoadingIndicator />
      ) : credentials.length === 0 ? (
        <Card>
          <Text variant="body">No credentials submitted yet.</Text>
          <Text variant="caption" className="mt-2">
            Home kitchen sellers typically need a food handler certification and, where required by
            your state, a cottage food permit.
          </Text>
        </Card>
      ) : (
        <View className="gap-3">
          {credentials.map((cred) => (
            <Card key={cred.id}>
              <View className="mb-2 flex-row items-start justify-between gap-3">
                <Text variant="heading" className="flex-1">
                  {CREDENTIAL_LABELS[cred.credential_type] ?? cred.credential_type}
                </Text>
                <StatusPill status={cred.verification_status} />
              </View>

              {docUrls[cred.id] ? (
                <Image
                  source={{ uri: docUrls[cred.id] }}
                  className="mb-2 h-40 w-full rounded-xl bg-line"
                  resizeMode="cover"
                />
              ) : null}

              {cred.issuing_authority ? (
                <Text variant="caption">Issued by: {cred.issuing_authority}</Text>
              ) : null}
              {cred.credential_number ? (
                <Text variant="caption">Number: {cred.credential_number}</Text>
              ) : null}
              {cred.expiry_date ? (
                <Text variant="caption">Expires: {cred.expiry_date}</Text>
              ) : null}
              {cred.verification_status === 'rejected' && cred.rejection_reason ? (
                <Text variant="caption" className="mt-1 text-danger">
                  Reason: {cred.rejection_reason}
                </Text>
              ) : null}

              {cred.verification_status === 'pending' ? (
                <View className="mt-3">
                  <Button
                    label="Remove submission"
                    variant="ghost"
                    onPress={() => handleDelete(cred)}
                  />
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}
