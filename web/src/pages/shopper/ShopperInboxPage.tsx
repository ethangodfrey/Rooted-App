import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

/**
 * Unified inbox — replaces segmented /shopper/messages and /vendor/messages.
 * Messaging backend is not wired yet; this keeps the shell route stable.
 */
export function ShopperInboxPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Inbox</h1>
      <p className="app-subtitle">
        Messages with creators, market hosts, and support — all in one place.
      </p>

      <div className="app-empty" style={{ textAlign: 'left' }}>
        <p style={{ margin: '0 0 0.75rem' }}>No conversations yet.</p>
        <p className="app-row-meta" style={{ margin: 0 }}>
          When a creator replies to an inquiry or order question, it will show up here.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/explore" className="app-btn app-btn--primary">
          Browse Explore
        </Link>
        <Link to="/orders" className="app-btn app-btn--secondary">
          View orders
        </Link>
      </div>
    </div>
  );
}
