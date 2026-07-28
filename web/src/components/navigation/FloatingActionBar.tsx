import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { isTabActive, type AppTab } from '@/components/navigation/app-tabs';
import {
  fabTabsForRole,
  type FabNavRole,
} from '@/components/navigation/fab-nav';
import { TabIcon } from '@/components/navigation/TabIcon';
import { LAUNCH_FEATURES } from '@/config/features';

type FloatingActionBarProps = {
  role: FabNavRole;
  /** Optional explicit tabs (e.g. creator shell). */
  tabs?: AppTab[];
};

/**
 * Bottom-left expandable FAB — primary page destinations by role
 * (Explore, Events nearby, Profile, …). Desktop keeps the sidebar.
 */
export function FloatingActionBar({ role, tabs: tabsOverride }: FloatingActionBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Creator menus never render when ENABLE_CREATOR_ROLE is false.
  const safeRole: FabNavRole =
    !LAUNCH_FEATURES.ENABLE_CREATOR_ROLE && role === 'CREATOR' ? 'VENDOR' : role;
  const tabs = fabTabsForRole(safeRole, tabsOverride);

  const onInit = useEffectEvent(() => {
    // eslint-disable-next-line no-console
    console.log(`FAB_UI_INITIALIZED ROLE=${safeRole}`);
    // eslint-disable-next-line no-console
    console.log(`FAB_SHELL_ALIGNED ROLE=${safeRole}`);
    if (!LAUNCH_FEATURES.ENABLE_CREATOR_ROLE) {
      // eslint-disable-next-line no-console
      console.log('CREATOR_SHELL_DISABLED');
    }
  });

  useEffect(() => {
    onInit();
  }, [safeRole]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      // eslint-disable-next-line no-console
      console.log(`NAVIGATION_UPDATED STATE=${next ? 'EXPANDED' : 'COLLAPSED'} ROLE=${safeRole}`);
      return next;
    });
  };

  const goTo = (to: string, label: string) => {
    // eslint-disable-next-line no-console
    console.log(`NAVIGATION_UPDATED DEST=${to} LABEL=${label} ROLE=${safeRole}`);
    setOpen(false);
    void navigate(to);
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-5 left-4 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative flex flex-col items-start">
        <div
          id={menuId}
          className={`pointer-events-auto absolute bottom-full left-0 mb-2 flex max-h-[70vh] flex-col-reverse gap-2 overflow-y-auto transition-all duration-300 ease-out ${
            open
              ? 'visible translate-y-0 scale-100 opacity-100'
              : 'invisible pointer-events-none translate-y-3 scale-95 opacity-0'
          }`}
          aria-hidden={!open}
        >
          {tabs.map((tab) => {
            const active = isTabActive(tab, location.pathname);
            return (
              <FabNavItem
                key={tab.to}
                tab={tab}
                active={active}
                onSelect={() => goTo(tab.to, tab.label)}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="pointer-events-auto inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold tracking-wide text-[var(--color-surface)] shadow-[var(--shadow-fab)] transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-95"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={toggle}
        >
          <span className="relative block h-4 w-4" aria-hidden="true">
            <span
              className={`absolute left-0 top-[7px] block h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ${
                open ? 'translate-y-0 rotate-45' : '-translate-y-1.5'
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] block h-0.5 w-4 rounded-full bg-current transition-opacity duration-150 ${
                open ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] block h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ${
                open ? 'translate-y-0 -rotate-45' : 'translate-y-1.5'
              }`}
            />
          </span>
          <span className="pr-0.5">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
    </div>
  );
}

function FabNavItem({
  tab,
  active,
  onSelect,
}: {
  tab: AppTab;
  active: boolean;
  onSelect: () => void;
}) {
  const className = `inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium shadow-[var(--shadow-fab)] transition-colors ${
    active
      ? 'text-[var(--color-primary)]'
      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-muted,var(--color-surface))]'
  }`;

  if (tab.external) {
    return (
      <a href={tab.to} className={className} aria-label={tab.label} onClick={onSelect}>
        <TabIcon
          name={tab.icon}
          size={18}
          color={active ? 'var(--color-primary)' : 'var(--color-muted)'}
        />
        <span>{tab.label}</span>
      </a>
    );
  }

  return (
    <NavLink
      to={tab.to}
      end={!tab.matchPaths?.length}
      className={className}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <TabIcon
        name={tab.icon}
        size={18}
        color={active ? 'var(--color-primary)' : 'var(--color-muted)'}
      />
      <span>{tab.label}</span>
    </NavLink>
  );
}
