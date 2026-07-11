import type { ReactNode } from 'react';

export type IconName =
  | 'trending-up'
  | 'check-square'
  | 'shield-check'
  | 'plus'
  | 'store'
  | 'message'
  | 'calendar'
  | 'receipt'
  | 'recycle'
  | 'grid'
  | 'credit-card'
  | 'badge';

const iconPaths: Record<IconName, ReactNode> = {
  'trending-up': <path d="M3 17l6-6 4 4 7-7M14 7h6v6" />,
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
  plus: <path d="M12 5v14M5 12h14" />,
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
