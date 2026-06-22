import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/App.css';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          {title}
        </h1>
        <p className="app-subtitle">Last updated: {lastUpdated}</p>
        <div className="legal-body" style={{ marginTop: '1.5rem', lineHeight: 1.65 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
