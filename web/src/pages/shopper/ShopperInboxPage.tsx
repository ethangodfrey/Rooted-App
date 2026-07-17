import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

export function ShopperInboxPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Inbox</h1>
      <p className="app-subtitle">Chats with vendors and market hosts.</p>
      <div className="app-empty" style={{ textAlign: 'left' }}>
        <p style={{ margin: '0 0 0.75rem' }}>No conversations yet.</p>
        <p className="app-row-meta" style={{ margin: 0 }}>
          Message a vendor from their storefront to start a thread.
        </p>
      </div>
      <div className="mt-6">
        <Link to="/explore" className="app-btn app-btn--primary">
          Explore markets
        </Link>
      </div>
    </div>
  );
}
