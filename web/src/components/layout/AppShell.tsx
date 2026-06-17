import { NavLink, Outlet } from 'react-router-dom';

import { EventLiveClock } from '@/components/events/EventLiveClock';
import { Logo } from '@/components/Logo';
import { ServerStatusBar } from '@/components/layout/ServerStatusBar';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

interface Tab {
  to: string;
  label: string;
  icon: string;
}

export function AppShell({
  role,
  tabs,
}: {
  role: 'shopper' | 'vendor' | 'admin';
  tabs: Tab[];
}) {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Logo size="small" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
            {user?.email}
          </span>
          <button type="button" className="app-btn app-btn--secondary app-btn--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="app-shell-clock">
        <EventLiveClock compact />
      </div>

      {import.meta.env.DEV ? <ServerStatusBar /> : null}

      <div className="app-layout">
        <nav className="app-sidebar" aria-label={`${role} navigation`}>
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end>
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>

      <nav className="app-tabbar" aria-label={`${role} tabs`}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end>
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
