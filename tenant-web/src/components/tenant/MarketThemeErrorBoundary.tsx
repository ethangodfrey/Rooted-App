'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { TenantNotFoundFallback } from './TenantNotFoundFallback';

type Props = {
  children: ReactNode;
  host?: string | null;
  slug?: string | null;
};

type State = {
  hasError: boolean;
  detail: string | null;
};

/**
 * Component-level boundary around MarketThemeProvider.
 * Catches unhandled exceptions during tenant/theme resolution render.
 */
export class MarketThemeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, detail: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      detail: error?.message?.slice(0, 160) || 'THEME_RENDER_EXCEPTION',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Uppercase text-only tracing (no emoji).
    // eslint-disable-next-line no-console
    console.log(
      `FALLBACK_TRIGGERED REASON=THEME_BOUNDARY SLUG=${this.props.slug ?? 'NONE'} DETAIL=${error.message} STACK=${info.componentStack?.slice(0, 80) ?? 'NONE'}`,
    );
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <TenantNotFoundFallback
          host={this.props.host}
          slug={this.props.slug}
          detail={this.state.detail}
        />
      );
    }
    return this.props.children;
  }
}
