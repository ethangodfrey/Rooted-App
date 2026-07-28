import { useEffect, useId, useState } from 'react';

import {
  fetchCollaboration,
  type JointContentItem,
} from '@/lib/meet-the-makers';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { isApiConfigured } from '@/lib/api';
import './active-collaboration.css';

type ActiveCollaborationBadgeProps = {
  profileId: string | null | undefined;
  className?: string;
};

/**
 * Shows ACTIVE COLLABORATION when the profile has co-authored partnership posts.
 * Click opens a modal of joint content.
 */
export function ActiveCollaborationBadge({
  profileId,
  className,
}: ActiveCollaborationBadgeProps) {
  const dialogId = useId();
  const [active, setActive] = useState(false);
  const [items, setItems] = useState<JointContentItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profileId || !isApiConfigured) {
      setActive(false);
      setItems([]);
      return;
    }
    let cancelled = false;
    void fetchCollaboration(profileId)
      .then((res) => {
        if (cancelled) return;
        setActive(Boolean(res.ACTIVE_COLLABORATION));
        setItems(res.ITEMS ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setActive(false);
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!active) return null;

  return (
    <>
      <button
        type="button"
        className={`active-collab-badge${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-controls={dialogId}
      >
        ACTIVE COLLABORATION
      </button>

      {open ? (
        <div
          className="active-collab-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            id={dialogId}
            className="active-collab-modal"
            role="dialog"
            aria-modal="true"
            aria-label="US joint partnership content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="active-collab-modal__header">
              <h2 className="active-collab-modal__title">Joint content</h2>
              <button
                type="button"
                className="active-collab-modal__close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {items.length === 0 ? (
              <p className="active-collab-modal__empty">
                No US co-authored posts yet.
              </p>
            ) : (
              <ul className="active-collab-modal__list">
                {items.map((item) => {
                  const mediaSrc = item.cdnMediaUrl || item.mediaUrl;
                  return (
                  <li key={item.postId} className="active-collab-modal__item">
                    {mediaSrc ? (
                      <FallbackImage
                        src={mediaSrc}
                        variant="product"
                        className="active-collab-modal__media"
                      />
                    ) : null}
                    <p className="active-collab-modal__caption">{item.caption}</p>
                    <p className="active-collab-modal__meta">
                      {[item.contributorType, item.partnerContributorType]
                        .filter(Boolean)
                        .join(' + ')}
                      {item.eventName ? ` · ${item.eventName}` : ''}
                      {item.operatingHours ? ` · ${item.operatingHours}` : ''}
                    </p>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
