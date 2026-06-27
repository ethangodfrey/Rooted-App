import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EXPLORE_CONTENT_TYPE_LABEL,
  EXPLORE_CONTENT_TYPES,
  createExploreContent,
  deleteExploreContent,
  fetchExploreContentForCreator,
  type ExploreCreator,
} from '@/lib/explore-content';
import { uploadProductImage } from '@/lib/upload';
import type { ExploreContent, ExploreContentType } from '@/types/database';

export function ExploreShowcaseManager({
  creator,
  uploaderUserId,
}: {
  creator: ExploreCreator;
  uploaderUserId: string;
}) {
  const [items, setItems] = useState<ExploreContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentType, setContentType] = useState<ExploreContentType>(EXPLORE_CONTENT_TYPES[0]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const creatorKey =
    creator.creatorType === 'vendor' ? creator.vendorId : creator.chefId;

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await fetchExploreContentForCreator(creator));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator.creatorType, creatorKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const mediaUrls: string[] = [];
      if (file) {
        mediaUrls.push(await uploadProductImage(uploaderUserId, file));
      }
      await createExploreContent(creator, {
        content_type: contentType,
        title: title.trim() || null,
        caption: caption.trim() || null,
        media_urls: mediaUrls,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setTitle('');
      setCaption('');
      setTags('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create showcase post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteExploreContent(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete post.');
    }
  }

  return (
    <div>
      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        <div className="app-input-group">
          <label htmlFor="explore-type">Post type</label>
          <select
            id="explore-type"
            className="app-select"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ExploreContentType)}
          >
            {EXPLORE_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXPLORE_CONTENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="app-input-group">
          <label htmlFor="explore-title">Title (optional)</label>
          <input
            id="explore-title"
            className="app-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="app-input-group">
          <label htmlFor="explore-caption">Caption</label>
          <textarea
            id="explore-caption"
            className="app-textarea"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tell the story behind this post…"
          />
        </div>
        <div className="app-input-group">
          <label htmlFor="explore-tags">Tags (comma-separated)</label>
          <input
            id="explore-tags"
            className="app-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="seasonal, vegan"
          />
        </div>
        <div className="app-input-group">
          <label htmlFor="explore-file">Image (optional)</label>
          <input
            id="explore-file"
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
          {submitting ? 'Publishing…' : 'Publish to Explore'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Your showcase posts</h2>
      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : items.length === 0 ? (
        <p className="app-row-meta">No showcase posts yet.</p>
      ) : (
        <div className="app-list">
          {items.map((item) => (
            <div key={item.id} className="app-card app-row saved-vendor-row">
              {item.media_urls?.[0] ? (
                <img
                  src={item.media_urls[0]}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                />
              ) : (
                <div className="app-row-icon">✨</div>
              )}
              <div className="app-row-body">
                <p className="app-row-title">
                  {item.title || EXPLORE_CONTENT_TYPE_LABEL[item.content_type]}
                </p>
                <p className="app-row-meta">{EXPLORE_CONTENT_TYPE_LABEL[item.content_type]}</p>
              </div>
              <button
                type="button"
                className="saved-vendor-remove"
                aria-label="Delete post"
                onClick={() => handleDelete(item.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
