import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CREDENTIAL_LABELS,
  CREDENTIAL_TYPE_OPTIONS,
  deletePendingCredential,
  fetchCredentials,
  submitCredential,
  uploadCredentialDocument,
} from '@/lib/verification';
import type { CredentialType, VerificationCredential, VerificationStatus } from '@/types/database';

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

export function CredentialManager({ userId }: { userId: string }) {
  const [credentials, setCredentials] = useState<VerificationCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<CredentialType>(CREDENTIAL_TYPE_OPTIONS[0].value);
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [credentialNumber, setCredentialNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCredentials(await fetchCredentials(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credentials.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      let documentPath: string | null = null;
      if (file) {
        documentPath = await uploadCredentialDocument(userId, type, file);
      }
      await submitCredential({
        userId,
        credentialType: type,
        documentPath,
        issuingAuthority,
        credentialNumber,
        expiryDate,
      });
      setIssuingAuthority('');
      setCredentialNumber('');
      setExpiryDate('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit credential.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(credential: VerificationCredential) {
    setError(null);
    try {
      await deletePendingCredential(credential);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete credential.');
    }
  }

  const activeHint = CREDENTIAL_TYPE_OPTIONS.find((o) => o.value === type)?.hint;

  return (
    <div>
      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        <div className="app-input-group">
          <label htmlFor="cred-type">Credential type</label>
          <select
            id="cred-type"
            className="app-select"
            value={type}
            onChange={(e) => setType(e.target.value as CredentialType)}
          >
            {CREDENTIAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {activeHint ? <p className="app-row-meta">{activeHint}</p> : null}
        </div>

        <div className="app-input-group">
          <label htmlFor="cred-authority">Issuing authority (optional)</label>
          <input
            id="cred-authority"
            className="app-input"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.target.value)}
            placeholder="e.g. State Health Department"
          />
        </div>

        <div className="app-input-group">
          <label htmlFor="cred-number">Credential number (optional)</label>
          <input
            id="cred-number"
            className="app-input"
            value={credentialNumber}
            onChange={(e) => setCredentialNumber(e.target.value)}
          />
        </div>

        <div className="app-input-group">
          <label htmlFor="cred-expiry">Expiry date (optional)</label>
          <input
            id="cred-expiry"
            type="date"
            className="app-input"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>

        <div className="app-input-group">
          <label htmlFor="cred-file">Document (image or PDF)</label>
          <input
            id="cred-file"
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="app-input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error ? <p className="app-error">{error}</p> : null}

        <button
          type="button"
          className="app-btn app-btn--primary"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Your credentials</h2>
      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : credentials.length === 0 ? (
        <p className="app-row-meta">No credentials submitted yet.</p>
      ) : (
        <div className="app-list">
          {credentials.map((cred) => (
            <div key={cred.id} className="app-card app-row saved-vendor-row">
              <div className="app-row-body">
                <p className="app-row-title">{CREDENTIAL_LABELS[cred.credential_type]}</p>
                <p className="app-row-meta">
                  <span className="app-status">{STATUS_LABEL[cred.verification_status]}</span>
                </p>
                {cred.verification_status === 'rejected' && cred.rejection_reason ? (
                  <p className="app-error" style={{ marginTop: '0.375rem' }}>
                    {cred.rejection_reason}
                  </p>
                ) : null}
              </div>
              {cred.verification_status === 'pending' ? (
                <button
                  type="button"
                  className="saved-vendor-remove"
                  aria-label="Delete credential"
                  onClick={() => handleDelete(cred)}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
