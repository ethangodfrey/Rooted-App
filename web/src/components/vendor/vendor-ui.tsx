import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge, type IconName } from '@/components/vendor/dashboard-icons';

export type VendorTone = 'amber' | 'emerald' | 'teal' | 'orange' | 'stone' | 'sky' | 'rose';

export const VENDOR_PRESSABLE =
  'active:scale-[0.99] transition-all duration-150 cursor-pointer';

export const VENDOR_LIST_PANEL =
  'overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/10';

export const VENDOR_FORM_PANEL =
  'rounded-xl border border-white/10 bg-white/[0.04] p-4';

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
    <div className="mb-6 rounded-xl border border-orange-500/30 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(249,115,22,0.28),transparent_55%),#121a36] p-5 text-zinc-50">
      {eyebrow ? (
        <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="m-0 mt-1 break-words text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
      {subtitle ? <p className="m-0 mt-2 text-sm font-medium leading-relaxed text-white/70">{subtitle}</p> : null}
      {pill ? (
        <span className="mt-3 inline-block rounded-lg border border-orange-400/30 bg-orange-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-300">
          {pill}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function VendorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
        {title}
      </p>
      {children}
    </section>
  );
}

export function VendorActionGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  const gridClass =
    cols === 3 ? 'grid-cols-1 gap-3 sm:grid-cols-3' : 'grid-cols-1 gap-3 sm:grid-cols-2';
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
  const className = `flex min-h-[88px] min-w-0 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left no-underline text-inherit ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <IconBadge name={icon} tone={tone} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-50">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-relaxed text-white/65">
            {subtitle}
          </span>
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
      className={`shrink-0 text-orange-400/80 ${className}`}
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
  const className = `flex w-full items-center justify-between gap-3 bg-transparent p-4 text-left no-underline active:bg-white/5 ${VENDOR_PRESSABLE}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <IconBadge name={icon} tone={tone} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-50">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs font-medium text-white/65">{subtitle}</span>
          ) : null}
          {meta ? <span className="mt-0.5 block truncate text-xs text-white/45">{meta}</span> : null}
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

  return <div className="flex items-center justify-between gap-3 p-4">{content}</div>;
}

export function VendorKpiGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  const gridClass =
    cols === 3 ? 'grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_1fr]' : 'grid-cols-2 gap-3';
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
    ? `flex min-h-[140px] min-w-0 flex-col justify-end rounded-xl border border-orange-500/35 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(249,115,22,0.28),transparent_55%),#121a36] p-5 text-left no-underline ${VENDOR_PRESSABLE}`
    : `flex min-h-[88px] min-w-0 flex-col items-start justify-center rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left no-underline ${VENDOR_PRESSABLE}`;

  const body = (
    <>
      <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-90">
        {label}
      </p>
      <p
        className={
          emphasize
            ? 'm-0 mt-2 text-4xl font-extrabold tracking-tight tabular-nums text-white md:text-5xl'
            : 'm-0 mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums leading-none text-zinc-50'
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
  return <div className={`${VENDOR_FORM_PANEL} min-w-0 ${className}`}>{children}</div>;
}

export function VendorEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center text-sm leading-relaxed text-white/65">
      {message}
    </div>
  );
}

export function VendorStatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-lg border border-orange-400/25 bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-300">
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
