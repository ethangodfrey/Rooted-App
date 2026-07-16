import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge, type IconName } from '@/components/vendor/dashboard-icons';

export type VendorTone = 'amber' | 'emerald' | 'teal' | 'orange' | 'stone' | 'sky' | 'rose';

export const VENDOR_PRESSABLE =
  'active:scale-[0.99] transition-all duration-150 cursor-pointer';

export const VENDOR_LIST_PANEL =
  'overflow-hidden rounded-xl border border-zinc-200/50 bg-white divide-y divide-zinc-200/50';

export const VENDOR_FORM_PANEL =
  'rounded-xl border border-zinc-200/50 bg-zinc-50/40 p-4';

export function VendorScreen({ children }: { children: ReactNode }) {
  return <div className="app-screen min-w-0 px-4 pb-10">{children}</div>;
}

export function VendorHero({
  eyebrow,
  title,
  subtitle,
  pill,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  pill?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-800/60 bg-zinc-950 p-5 text-zinc-50">
      {eyebrow ? (
        <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{eyebrow}</p>
      ) : null}
      <h1 className="m-0 mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle ? <p className="m-0 mt-1 text-xs font-medium text-zinc-400">{subtitle}</p> : null}
      {pill ? (
        <span className="mt-3 inline-block rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
          {pill}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function VendorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
      {children}
    </section>
  );
}

export function VendorActionGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  const gridClass = cols === 3 ? 'grid-cols-3 gap-3' : 'grid-cols-2 gap-3';
  return <div className={`mb-5 grid ${gridClass}`}>{children}</div>;
}

export function VendorActionTile({
  to,
  title,
  subtitle,
  icon,
  tone,
  onClick,
}: {
  to?: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  tone: VendorTone;
  onClick?: () => void;
}) {
  const className = `flex min-h-[74px] min-w-0 items-start gap-2.5 rounded-xl border border-zinc-200/50 bg-white p-3 text-left no-underline text-inherit ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <IconBadge name={icon} tone={tone} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-900">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-xs font-medium text-zinc-500">{subtitle}</span>
        ) : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  );
}

export function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 text-zinc-400 ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function VendorListPanel({ children }: { children: ReactNode }) {
  return <div className={VENDOR_LIST_PANEL}>{children}</div>;
}

export function VendorListRow({
  to,
  onClick,
  title,
  subtitle,
  meta,
  icon,
  tone,
  trailing,
  external,
}: {
  to?: string;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  meta?: string;
  icon: IconName;
  tone: VendorTone;
  trailing?: ReactNode;
  external?: boolean;
}) {
  const className = `flex w-full items-center justify-between gap-3 bg-transparent p-3.5 text-left no-underline active:bg-zinc-50 ${VENDOR_PRESSABLE}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <IconBadge name={icon} tone={tone} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-900">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs font-medium text-zinc-500">{subtitle}</span>
          ) : null}
          {meta ? <span className="mt-0.5 block truncate text-xs text-zinc-400">{meta}</span> : null}
        </span>
      </span>
      {trailing ?? <ChevronRight />}
    </>
  );

  if (to) {
    if (external) {
      return (
        <a href={to} className={className}>
          {content}
        </a>
      );
    }
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="flex items-center justify-between gap-3 p-3.5">{content}</div>;
}

export function VendorKpiGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  // Prefer asymmetric layouts — avoid uniform 3-up rows when possible.
  const gridClass =
    cols === 3 ? 'grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]' : 'grid-cols-2 gap-3';
  return <div className={`mb-5 grid ${gridClass}`}>{children}</div>;
}

export function VendorKpiStat({
  to,
  value,
  label,
  onClick,
  emphasize,
}: {
  to?: string;
  value: string | number;
  label: string;
  onClick?: () => void;
  emphasize?: boolean;
}) {
  const className = emphasize
    ? `flex min-h-[120px] min-w-0 flex-col justify-end rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 text-left no-underline ${VENDOR_PRESSABLE}`
    : `flex min-h-[74px] min-w-0 flex-col items-start justify-center rounded-xl border border-zinc-200/50 bg-white p-3 text-left no-underline ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <p
        className={
          emphasize
            ? 'm-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400'
            : 'm-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400'
        }
      >
        {label}
      </p>
      <p
        className={
          emphasize
            ? 'm-0 mt-2 text-4xl font-extrabold tracking-tight tabular-nums text-zinc-50'
            : 'm-0 mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums leading-none text-zinc-900'
        }
      >
        {value}
      </p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export function VendorFormPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${VENDOR_FORM_PANEL} ${className}`}>{children}</div>;
}

export function VendorEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200/60 bg-zinc-50/40 px-4 py-6 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

export function VendorStatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 rounded border border-zinc-200/50 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
      {label}
    </span>
  );
}

export function VendorPrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`app-btn app-btn--primary ${VENDOR_PRESSABLE} ${className}`}
    >
      {children}
    </button>
  );
}

export function VendorSecondaryButton({
  children,
  to,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const classes = `app-btn app-btn--secondary ${VENDOR_PRESSABLE} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
