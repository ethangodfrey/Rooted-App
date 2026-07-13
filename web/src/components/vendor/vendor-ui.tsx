import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge, type IconName } from '@/components/vendor/dashboard-icons';

export type VendorTone = 'amber' | 'emerald' | 'teal' | 'orange' | 'stone' | 'sky' | 'rose';

export const VENDOR_PRESSABLE =
  'active:scale-[0.99] transition-all duration-150 cursor-pointer';

export const VENDOR_LIST_PANEL =
  'overflow-hidden rounded-xl border border-stone-200/40 bg-stone-100/40 divide-y divide-stone-200/60';

export const VENDOR_FORM_PANEL =
  'min-w-0 overflow-hidden rounded-xl border border-stone-200/40 bg-stone-100/60 p-4';

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
    <div className="mb-6 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-600 to-amber-500 p-5 text-white shadow-md">
      {eyebrow ? (
        <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-white/80">{eyebrow}</p>
      ) : null}
      <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="m-0 mt-1 text-sm text-white/85">{subtitle}</p> : null}
      {pill ? (
        <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
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
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">{title}</p>
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
  const className = `flex min-h-[74px] min-w-0 items-start gap-2.5 rounded-xl border border-stone-200/40 bg-stone-100/60 p-3 text-left no-underline text-inherit ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <IconBadge name={icon} tone={tone} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-stone-800">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-xs text-stone-500">{subtitle}</span>
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
      className={`shrink-0 text-stone-400 ${className}`}
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
  const className = `flex w-full items-center justify-between gap-3 bg-transparent p-3.5 text-left no-underline active:bg-stone-100/80 ${VENDOR_PRESSABLE}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <IconBadge name={icon} tone={tone} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-stone-800">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs text-stone-500">{subtitle}</span>
          ) : null}
          {meta ? <span className="mt-0.5 block truncate text-xs text-stone-400">{meta}</span> : null}
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
  const gridClass =
    cols === 3 ? 'grid-cols-2 gap-3 sm:grid-cols-3' : 'grid-cols-2 gap-3';
  return <div className={`mb-5 grid ${gridClass}`}>{children}</div>;
}

export function VendorKpiStat({
  to,
  value,
  label,
  onClick,
}: {
  to?: string;
  value: string | number;
  label: string;
  onClick?: () => void;
}) {
  const className = `flex min-h-[74px] min-w-0 flex-col items-center justify-center rounded-xl border border-stone-200/40 bg-stone-100/60 p-3 text-center no-underline ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <p className="m-0 text-2xl font-bold tabular-nums leading-none text-stone-800">{value}</p>
      <p className="m-0 mt-1.5 max-w-full text-[10px] font-bold uppercase leading-tight tracking-wider text-stone-500">
        {label}
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
    <div className="rounded-xl border border-dashed border-stone-200/60 bg-stone-100/40 px-4 py-6 text-center text-sm text-stone-500">
      {message}
    </div>
  );
}

export function VendorStatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
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
