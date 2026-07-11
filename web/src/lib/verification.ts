import { supabase } from '@/lib/supabase';
import type { CredentialType, VerificationCredential } from '@/types/database';

/** Private bucket — documents are sensitive, served via short-lived signed URLs. */
const BUCKET = 'verification-docs';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Human labels for each credential type, in the order shown in the picker. */
export const CREDENTIAL_TYPE_OPTIONS: { value: CredentialType; label: string; hint: string }[] = [
  {
    value: 'food_safety_certified',
    label: 'Food handler / safety',
    hint: 'Food handler card or safety certification',
  },
  {
    value: 'cottage_food_permit',
    label: 'Cottage food permit',
    hint: 'State or local cottage food operation permit',
  },
  {
    value: 'business_license',
    label: 'Business license',
    hint: 'Registered business or sales tax license',
  },
  {
    value: 'health_department_permit',
    label: 'Health dept. permit',
    hint: 'Local health department inspection / permit',
  },
  {
    value: 'commercial_kitchen',
    label: 'Commercial kitchen',
    hint: 'Commercial / commissary kitchen agreement',
  },
  {
    value: 'liability_insurance',
    label: 'Liability insurance',
    hint: 'Product or general liability coverage',
  },
  {
    value: 'identity_verified',
    label: 'Government ID',
    hint: 'Government-issued photo identification',
  },
];

export const CREDENTIAL_LABELS: Record<CredentialType, string> = {
  identity_verified: 'Government ID',
  food_safety_certified: 'Food safety certification',
  cottage_food_permit: 'Cottage food permit',
  commercial_kitchen: 'Commercial kitchen license',
  health_department_permit: 'Health department permit',
  liability_insurance: 'Liability insurance',
  business_license: 'Business license',
};

/**
 * Credential types that, once verified, award a public trust badge.
 * Mirrors the mobile mapping (phase23 seeds only these two badge types).
 */
const CREDENTIAL_BADGE_MAP: Partial<Record<CredentialType, string>> = {
  identity_verified: 'identity_verified',
  food_safety_certified: 'food_safety_certified',
};

/**
 * Maps a credential type to the `vendor_compliance` boolean it satisfies once
 * verified.
 */
const CREDENTIAL_COMPLIANCE_FLAG: Partial<
  Record<CredentialType, 'has_food_handler_cert' | 'has_required_permits'>
> = {
  food_safety_certified: 'has_food_handler_cert',
  cottage_food_permit: 'has_required_permits',
  health_department_permit: 'has_required_permits',
  business_license: 'has_required_permits',
};

export interface SubmitCredentialInput {
  userId: string;
  credentialType: CredentialType;
  documentPath: string | null;
  issuingAuthority?: string | null;
  credentialNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
}

/** A pending credential joined with the submitting user, for admin review. */
export type AdminCredentialRow = VerificationCredential & {
  users: { id: string; name: string | null; email: string | null; role: string | null } | null;
};

/**
 * Uploads a credential document to the private verification-docs bucket under
 * the user's own folder. Returns the storage object PATH (not a public URL).
 */
export async function uploadCredentialDocument(
  userId: string,
  credentialType: CredentialType,
  file: File,
): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'pdf'
          ? 'application/pdf'
          : 'image/jpeg';
  const path = `${userId}/${credentialType}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Resolves a stored `document_url` to a viewable URL. Storage paths are signed
 * for short-lived access; already-absolute URLs (legacy rows) are returned as-is.
 */
export async function resolveCredentialDocumentUrl(
  documentUrl: string | null,
): Promise<string | null> {
  if (!documentUrl) return null;
  if (/^https?:\/\//i.test(documentUrl)) return documentUrl;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(documentUrl, SIGNED_URL_TTL_SECONDS);

  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Fetch all credentials for a creator, newest first. */
export async function fetchCredentials(userId: string): Promise<VerificationCredential[]> {
  const { data, error } = await supabase
    .from('verification_credentials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VerificationCredential[];
}

/** Create a new (pending) credential submission. */
export async function submitCredential(
  input: SubmitCredentialInput,
): Promise<VerificationCredential> {
  const { data, error } = await supabase
    .from('verification_credentials')
    .insert({
      user_id: input.userId,
      credential_type: input.credentialType,
      document_url: input.documentPath,
      issuing_authority: input.issuingAuthority?.trim() || null,
      credential_number: input.credentialNumber?.trim() || null,
      issue_date: input.issueDate?.trim() || null,
      expiry_date: input.expiryDate?.trim() || null,
      verification_status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as VerificationCredential;
}

/** Delete a pending credential and its uploaded document. */
export async function deletePendingCredential(credential: VerificationCredential): Promise<void> {
  const { error } = await supabase
    .from('verification_credentials')
    .delete()
    .eq('id', credential.id);

  if (error) throw error;

  if (credential.document_url && !/^https?:\/\//i.test(credential.document_url)) {
    await supabase.storage.from(BUCKET).remove([credential.document_url]);
  }
}

/** Admin: list credentials pending review (optionally include all statuses). */
export async function fetchCredentialsForReview(
  status: 'pending' | 'all' = 'pending',
): Promise<AdminCredentialRow[]> {
  let query = supabase
    .from('verification_credentials')
    .select('*, users:users!verification_credentials_user_id_fkey(id, name, email, role)')
    .order('created_at', { ascending: false });

  if (status === 'pending') {
    query = query.eq('verification_status', 'pending');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AdminCredentialRow[];
}

/**
 * Admin: approve a credential. Marks it verified and, when the credential type
 * maps to a public trust badge, awards that badge to the creator (idempotent).
 */
export async function approveCredential(
  credential: Pick<VerificationCredential, 'id' | 'user_id' | 'credential_type'>,
  adminUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('verification_credentials')
    .update({
      verification_status: 'verified',
      verified_by: adminUserId,
      verified_at: new Date().toISOString(),
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', credential.id);

  if (error) throw error;

  await awardBadgeForCredential(credential.user_id, credential.credential_type);
  await syncVendorComplianceForCredential(credential.user_id, credential.credential_type);
}

/** Admin: reject a credential with an optional reason. */
export async function rejectCredential(
  credentialId: string,
  adminUserId: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('verification_credentials')
    .update({
      verification_status: 'rejected',
      verified_by: adminUserId,
      verified_at: new Date().toISOString(),
      rejection_reason: reason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', credentialId);

  if (error) throw error;
}

/** Award the trust badge mapped to a credential type, if any. Idempotent. */
async function awardBadgeForCredential(
  userId: string,
  credentialType: CredentialType,
): Promise<void> {
  const badgeType = CREDENTIAL_BADGE_MAP[credentialType];
  if (!badgeType) return;

  const { data: badge } = await supabase
    .from('trust_badges')
    .select('id')
    .eq('badge_type', badgeType)
    .maybeSingle();

  if (!badge?.id) return;

  await supabase
    .from('user_badges')
    .upsert(
      { user_id: userId, badge_id: badge.id },
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    );
}

/**
 * When an approved credential belongs to a vendor, flip the matching
 * `vendor_compliance` boolean. Chefs have no compliance row (no-op).
 */
async function syncVendorComplianceForCredential(
  userId: string,
  credentialType: CredentialType,
): Promise<void> {
  const flag = CREDENTIAL_COMPLIANCE_FLAG[credentialType];
  if (!flag) return;

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!vendor?.id) return;

  await supabase.from('vendor_compliance').upsert(
    {
      vendor_id: vendor.id,
      [flag]: true,
      last_compliance_check: new Date().toISOString(),
    },
    { onConflict: 'vendor_id' },
  );
}
