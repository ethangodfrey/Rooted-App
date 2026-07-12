import type { ReactNode } from 'react';

export type IconName =
  | 'trending-up'
  | 'dollar-sign'
  | 'check-square'
  | 'package'
  | 'shield-check'
  | 'file-text'
  | 'plus'
  | 'edit'
  | 'store'
  | 'message'
  | 'calendar'
  | 'receipt'
  | 'recycle'
  | 'grid'
  | 'credit-card'
  | 'badge'
  | 'clipboard'
  | 'image'
  | 'video'
  | 'map-pin'
  | 'settings'
  | 'users'
  | 'link';

const iconPaths: Record<IconName, ReactNode> = {
  'trending-up': <path d="M3 17l6-6 4 4 7-7M14 7h6v6" />,
  'dollar-sign': (
    <>
      <path d="M12 2v20" />
      <path d="M17 7.5c0-2-2.5-3.5-5-3.5S7 5.5 7 7.5 9.5 11 12 11s5 1.5 5 3.5-2.5 3.5-5 3.5-5-1.5-5-3.5" />
    </>
  ),
  'check-square': (
    <>
      <path d="M9 12 11 14 15 10" />
      <path d="M5 5h14v14H5z" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 3 5 6v6c0 4.5 3 7 7 9 4-2 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  package: (
    <>
      <path d="M12 22 2 17V7l10-5 10 5v10Z" />
      <path d="m12 12 10-5M12 12v10M12 12 2 7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  store: (
    <>
      <path d="M4 10h16" />
      <path d="M6 10V7l2-3h8l2 3v3" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  message: <path d="M5 5h14v10H8l-3 3V5Z" />,
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 4v4M16 4v4M4 10h16" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 4h12v16l-2-1-2 1-2-1-2 1-2-1-2 1V4Z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  recycle: (
    <>
      <path d="M7 7h4l2-3M17 7h-4l-2-3M12 21V11" />
      <path d="M5 14l2 4h10l2-4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  badge: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M8 14h8l1 6H7l1-6Z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="4" width="8" height="4" rx="1" />
      <path d="M8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8h-2" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m4 16 5-5 4 4 5-6 2 3" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3Z" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c.5-2 2-3.5 5-3.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1 1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1-1" />
    </>
  ),
};

export function DashboardIcon({
  name,
  className = '',
  size = 16,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {iconPaths[name]}
    </svg>
  );
}

export function IconBadge({
  name,
  tone,
}: {
  name: IconName;
  tone: 'amber' | 'emerald' | 'teal' | 'orange' | 'stone' | 'sky' | 'rose';
}) {
  const tones: Record<typeof tone, string> = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    teal: 'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
    stone: 'bg-stone-200/70 text-stone-600',
    sky: 'bg-sky-100 text-sky-700',
    rose: 'bg-rose-100 text-rose-700',
  };

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}
    >
      <DashboardIcon name={name} size={15} />
    </span>
  );
}
