import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { LeafIcon } from '@/components/LeafIcon';
import { Logo } from '@/components/Logo';
import '@/App.css';
import './legal.css';
import { LEGAL_LAST_UPDATED } from './legal-config';

interface LegalLayoutProps {
  title: string;
  documentTitle: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, documentTitle, children }: LegalLayoutProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <>
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/" className="nav__brand">
            <span className="nav__icon" aria-hidden="true">
              <LeafIcon size={22} />
            </span>
            <Logo size="small" />
          </Link>

          <div className="nav__actions">
            <Link to="/" className="btn btn--secondary nav__signin">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-article">
          <p className="eyebrow">Legal</p>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
          {children}
        </article>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Logo variant="reversed" size="medium" />
            <p>Local markets. Local makers.</p>
          </div>

          <nav className="footer__links" aria-label="Footer">
            <Link to="/">Home</Link>
            <Link to="/legal/privacy">Privacy Policy</Link>
            <Link to="/legal/terms">Terms of Service</Link>
            <Link to="/login">Sign in</Link>
          </nav>

          <p className="footer__copy">
            &copy; {new Date().getFullYear()} Rooted. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
