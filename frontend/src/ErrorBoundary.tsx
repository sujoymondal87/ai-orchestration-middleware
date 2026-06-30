import { Component, ErrorInfo, ReactNode } from 'react';

interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0f0f11', color: '#e8e8ea', gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: '#666', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ background: '#6c5ce7', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 6 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
