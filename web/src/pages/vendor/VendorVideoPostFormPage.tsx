import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSecondaryButton,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { uploadVendorVideo } from '@/lib/upload';
import type { PostType } from '@/types/database';
import '@/components/ui/ui.css';

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'update', label: 'Update' },
  { value: 'product', label: 'Product' },
  { value: 'event', label: 'Event' },
  { value: 'promo', label: 'Promo' },
];

export function VendorVideoPostFormPage() {
  const navigate = useNavigate();
  const { vendor, user } = useAuth();
  const [postType, setPostType] = useState<PostType>('update');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ caption?: string; video?: string }>({});

  async function handleVideoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setError(null);
    setUploading(true);
    try {
      const url = await uploadVendorVideo(user.id, file);
      setVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleSave() {
    const nextFieldErrors: { caption?: string; video?: string } = {};
    if (!caption.trim()) {
      nextFieldErrors.caption = 'Caption is required.';
    }
    if (!videoUrl) {
      nextFieldErrors.video = 'Add a video for this post.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    if (!vendor) return;

    setFieldErrors({});
    setSaving(true);
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('posts').insert({
      vendor_id: vendor.id,
      post_type: postType,
      caption: caption.trim(),
      media_url: videoUrl,
      media_type: 'video',
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
      <VendorHero eyebrow="Manage" title="New video" />

      <VendorFormPanel>
        <div className="app-chip-row">
          {POST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`app-chip ${VENDOR_PRESSABLE}${postType === t.value ? ' app-chip--selected' : ''}`}
              onClick={() => setPostType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="app-input-group">
          <label>Caption</label>
          <textarea
            className={`app-textarea${fieldErrors.caption ? ' app-textarea--invalid' : ''}`}
            value={caption}
            aria-invalid={Boolean(fieldErrors.caption)}
            onChange={(e) => {
              setCaption(e.target.value);
              setFieldErrors((prev) => {
                if (!prev.caption) return prev;
                const next = { ...prev };
                delete next.caption;
                return next;
              });
            }}
            rows={5}
          />
          <FieldError message={fieldErrors.caption} />
        </div>

        <div className="app-input-group">
          <label>Video</label>
          {videoUrl ? (
            <div>
              <video
                src={videoUrl}
                controls
                playsInline
                style={{ width: '100%', borderRadius: '12px', marginBottom: '0.5rem', maxHeight: 280 }}
              />
              <VendorSecondaryButton
                onClick={() => {
                  setVideoUrl(null);
                  setFieldErrors((prev) => {
                    if (!prev.video) return prev;
                    const next = { ...prev };
                    delete next.video;
                    return next;
                  });
                }}
              >
                Remove video
              </VendorSecondaryButton>
            </div>
          ) : (
            <label className="app-btn app-btn--secondary inline-block cursor-pointer">
              {uploading ? 'Uploading…' : 'Choose video (max 50 MB)'}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => {
                  void handleVideoChange(e);
                  setFieldErrors((prev) => {
                    if (!prev.video) return prev;
                    const next = { ...prev };
                    delete next.video;
                    return next;
                  });
                }}
              />
            </label>
          )}
          <FieldError message={fieldErrors.video} />
        </div>

        {error ? <p className="app-error">{error}</p> : null}

        <VendorPrimaryButton className="w-full" disabled={saving || uploading} onClick={handleSave}>
          {saving ? 'Publishing…' : 'Publish video'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
