import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import {
  createContentContribution,
  type DualContributorType,
  type DualPostingMode,
} from '@/lib/content-contributions';
import { fetchConnectedNetworkRows } from '@/lib/network-connections';
import { isApiConfigured } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { PostType } from '@/types/database';
import '@/components/ui/ui.css';

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'update', label: 'Update' },
  { value: 'product', label: 'Product' },
  { value: 'event', label: 'Event' },
  { value: 'promo', label: 'Promo' },
];

type PartnerOption = {
  connectionId: string;
  peerProfileId: string;
  partnerType: DualContributorType;
  label: string;
};

export function VendorPostFormPage() {
  const navigate = useNavigate();
  const { vendor, user } = useAuth();
  const [postType, setPostType] = useState<PostType>('update');
  const [caption, setCaption] = useState('');
  const [postingMode, setPostingMode] = useState<DualPostingMode>('SELF');
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [selectedPartnerKey, setSelectedPartnerKey] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPartners() {
      if (!user?.id) return;
      try {
        const rows = await fetchConnectedNetworkRows(user.id);
        const options: PartnerOption[] = [];
        for (const row of rows) {
          const peerId =
            row.sender_id === user.id ? row.receiver_id : row.sender_id;
          const { data: peer } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', peerId)
            .maybeSingle();
          const { data: vendorPeer } = await supabase
            .from('vendors')
            .select('business_name')
            .eq('user_id', peerId)
            .maybeSingle();
          const { data: farmerPeer } = await supabase
            .from('farmers')
            .select('farm_name')
            .eq('user_id', peerId)
            .maybeSingle();
          const role = (peer as { role?: string } | null)?.role;
          const partnerType: DualContributorType =
            role === 'farmer' ? 'FARMER' : 'VENDOR';
          const label =
            (vendorPeer as { business_name?: string } | null)?.business_name ??
            (farmerPeer as { farm_name?: string } | null)?.farm_name ??
            peerId.slice(0, 8);
          options.push({
            connectionId: row.id,
            peerProfileId: peerId,
            partnerType,
            label,
          });
        }
        setPartners(options);
        if (options[0]) {
          setSelectedPartnerKey(options[0].connectionId);
        }
      } catch {
        setPartners([]);
      }
    }
    void loadPartners();
  }, [user?.id]);

  async function handleSave() {
    if (!vendor || !user) return;
    if (!caption.trim()) {
      setCaptionError('Caption is required.');
      setError(null);
      return;
    }

    if (postingMode === 'PARTNERSHIP' && !selectedPartnerKey) {
      setError('Select a connected partner for partnership posting.');
      return;
    }

    setCaptionError(null);
    setSaving(true);
    setError(null);

    const partner = partners.find((p) => p.connectionId === selectedPartnerKey);

    try {
      if (isApiConfigured) {
        await createContentContribution({
          caption: caption.trim(),
          postingMode,
          contentKind: 'text',
          postType,
          authorType: 'VENDOR',
          partnerId:
            postingMode === 'PARTNERSHIP' ? partner?.peerProfileId ?? null : null,
          partnerType:
            postingMode === 'PARTNERSHIP' ? partner?.partnerType ?? null : null,
          partnershipConnectionId:
            postingMode === 'PARTNERSHIP' ? partner?.connectionId ?? null : null,
        });
      } else {
        const now = new Date().toISOString();
        const { error: insertError } = await supabase.from('posts').insert({
          vendor_id: vendor.id,
          post_type: postType,
          caption: caption.trim(),
          contributor_id: user.id,
          contributor_type: 'VENDOR',
          content_type: 'TEXT',
          posting_mode: postingMode,
          partnership_connection_id:
            postingMode === 'PARTNERSHIP' ? partner?.connectionId ?? null : null,
          partner_contributor_id:
            postingMode === 'PARTNERSHIP' ? partner?.peerProfileId ?? null : null,
          partner_contributor_type:
            postingMode === 'PARTNERSHIP' ? partner?.partnerType ?? null : null,
          co_approval_status: postingMode === 'PARTNERSHIP' ? 'PENDING' : 'NONE',
          contribution_metadata: {
            parties:
              postingMode === 'PARTNERSHIP' && partner
                ? [
                    {
                      contributorId: user.id,
                      contributorType: 'VENDOR',
                      role: 'AUTHOR',
                    },
                    {
                      contributorId: partner.peerProfileId,
                      contributorType: partner.partnerType,
                      role: 'PARTNER',
                    },
                  ]
                : [
                    {
                      contributorId: user.id,
                      contributorType: 'VENDOR',
                      role: 'AUTHOR',
                    },
                  ],
            postingMode,
            contentType: 'TEXT',
          },
          publish_at: now,
          created_at: now,
        });
        if (insertError) throw new Error(insertError.message);
      }

      navigate('/vendor/posts');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not publish post.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <VendorScreen>
      <Link to="/vendor/posts" className="app-back-link">← Posts</Link>
      <VendorHero eyebrow="Manage" title="New post" />

      <VendorFormPanel>
        <div className="app-chip-row">
          {POST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`app-chip ${VENDOR_PRESSABLE}${postType === t.value ? ' app-chip--selected' : ''}`}
              onClick={() => setPostType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="app-input-group">
          <label>Posting as</label>
          <div className="app-chip-row">
            <button
              type="button"
              className={`app-chip ${VENDOR_PRESSABLE}${postingMode === 'SELF' ? ' app-chip--selected' : ''}`}
              onClick={() => setPostingMode('SELF')}
            >
              Myself
            </button>
            <button
              type="button"
              className={`app-chip ${VENDOR_PRESSABLE}${postingMode === 'PARTNERSHIP' ? ' app-chip--selected' : ''}`}
              onClick={() => setPostingMode('PARTNERSHIP')}
            >
              On Behalf of Partnership
            </button>
          </div>
        </div>

        {postingMode === 'PARTNERSHIP' ? (
          <div className="app-input-group">
            <label>Partner</label>
            {partners.length === 0 ? (
              <p className="text-sm text-stone-500">No connected partners yet.</p>
            ) : (
              <select
                className="app-input"
                value={selectedPartnerKey}
                onChange={(e) => setSelectedPartnerKey(e.target.value)}
              >
                {partners.map((p) => (
                  <option key={p.connectionId} value={p.connectionId}>
                    {p.label} ({p.partnerType})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        <div className="app-input-group">
          <label>Caption</label>
          <textarea
            className={`app-textarea${captionError ? ' app-textarea--invalid' : ''}`}
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              if (captionError) setCaptionError(null);
            }}
            rows={5}
          />
          <FieldError message={captionError} />
        </div>

        {error ? <p className="app-error">{error}</p> : null}

        <VendorPrimaryButton className="w-full" disabled={saving} onClick={handleSave}>
          {saving ? 'Publishing…' : 'Publish post'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
