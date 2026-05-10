import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="card-clinical p-10 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-sm">Terjadi kesalahan saat memuat data</p>
          <p className="text-xs text-muted-foreground font-mono-data">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={12} />
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
