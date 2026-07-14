import { useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import type { PostType } from '@/types/database';
import '@/components/ui/ui.css';

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'update', label: 'Update' },
  { value: 'product', label: 'Product' },
  { value: 'event', label: 'Event' },
  { value: 'promo', label: 'Promo' },
];

export function VendorPostFormPage() {
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const [postType, setPostType] = useState<PostType>('update');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);

  async function handleSave() {
    if (!vendor) return;

    if (!caption.trim()) {
      setCaptionError('Caption is required.');
      setError(null);
      return;
    }

    setCaptionError(null);

    setSaving(true);
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('posts').insert({
      vendor_id: vendor.id,
      post_type: postType,
      caption: caption.trim(),
      publish_at: now,
      created_at: now,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate('/vendor/posts');
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
