import { VerticalVideoFeed } from '@/components/creator/VerticalVideoFeed';

/**
 * Phase 83g — creator multimedia feed shell (`/creator/feed`).
 */
export function CreatorFeedPage() {
  return (
    <div className="app-screen">
      <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
        Creator · Multimedia
      </p>
      <h1 className="app-title" style={{ marginBottom: '0.5rem' }}>
        Feed
      </h1>
      <p className="ft-subhead" style={{ marginBottom: '1rem' }}>
        Full-screen vertical posts from the Vendorly network — swipe to browse, tap to engage.
      </p>
      <VerticalVideoFeed />
    </div>
  );
}
