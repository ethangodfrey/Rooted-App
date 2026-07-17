import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

export function VendorInboxPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Inbox</h1>
      <p className="app-subtitle">Chats with customers and connected vendors.</p>
      <div className="app-empty" style={{ textAlign: 'left' }}>
        <p style={{ margin: '0 0 0.75rem' }}>No conversations yet.</p>
        <p className="app-row-meta" style={{ margin: 0 }}>
          Customer inquiries and vendor-network messages will appear here.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/vendor/network" className="app-btn app-btn--primary">
          Open Vendor Network
        </Link>
        <Link to="/vendor/map" className="app-btn app-btn--secondary">
          Open markets map
        </Link>
      </div>
    </div>
  );
}
