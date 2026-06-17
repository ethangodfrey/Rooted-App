import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    if (!vendor || !caption.trim()) {
      setError('Caption is required.');
      return;
    }
    if (!videoUrl) {
      setError('Add a video for this post.');
      return;
    }

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
    <div className="app-screen app-screen--narrow">
      <Link to="/vendor/posts" className="app-back-link">← Posts</Link>
      <h1 className="app-title">New video</h1>

      <div className="app-chip-row">
        {POST_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`app-chip${postType === t.value ? ' app-chip--selected' : ''}`}
            onClick={() => setPostType(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="app-input-group">
        <label>Caption</label>
        <textarea
          className="app-textarea"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          placeholder="Describe your video — product demo, market day, behind the scenes..."
        />
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
            <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={() => setVideoUrl(null)}>
              Remove video
            </button>
          </div>
        ) : (
          <label className="app-btn app-btn--secondary" style={{ display: 'inline-block', cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : 'Choose video (max 50 MB)'}
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleVideoChange}
            />
          </label>
        )}
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--primary"
        disabled={saving || uploading}
        onClick={handleSave}>
        {saving ? 'Publishing…' : 'Publish video'}
      </button>
    </div>
  );
}
