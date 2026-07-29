import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Root client boundary for the Vite SPA — prevents a render crash from
 * unmounting #root into a white screen of death.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.log('GLOBAL_ERROR_BOUNDARY_ADDED');
    // eslint-disable-next-line no-console
    console.log(
      `CLIENT_CRASH_CAUGHT SCOPE=VITE_ROOT DETAIL=${error.message} COMPONENT=${info.componentStack?.split('\n')[1]?.trim() ?? 'UNKNOWN'}`,
    );
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const showDetail =
      import.meta.env.DEV ||
      import.meta.env.MODE === 'staging' ||
      window.location.hostname.includes('vercel.app');

    return (
      <main
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0B1228',
          color: '#f8fafc',
          fontFamily: "'IBM Plex Sans', Segoe UI, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#f97316',
            }}
          >
            CLIENT_CRASH_CAUGHT
          </p>
          <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, color: 'rgba(248,250,252,0.68)', lineHeight: 1.6 }}>
            Vendorly hit an unexpected client error. Reload to recover this session.
          </p>
          {showDetail ? (
            <pre
              style={{
                marginTop: '1.25rem',
                textAlign: 'left',
                overflow: 'auto',
                borderRadius: 12,
                border: '1px solid rgba(249,115,22,0.35)',
                background: '#121a36',
                padding: '1rem',
                fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'rgba(255,237,213,0.92)',
              }}
            >
              {this.state.error.message || 'UNKNOWN_CLIENT_ERROR'}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: '1.5rem',
              border: 0,
              borderRadius: 12,
              background: '#ea580c',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.04em',
              padding: '0.85rem 1.5rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }
}
