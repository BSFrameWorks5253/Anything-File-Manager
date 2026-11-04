import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AFM ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetPath = () => {
    localStorage.removeItem('afm:lastPath');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0c0d12] text-white p-6 select-none">
          <div className="max-w-md w-full bg-[#161822] border border-red-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Display Recovery</h2>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">
              Anything File Manager encountered an unexpected UI rendering exception. Your filesystem and data remain safe.
            </p>
            {this.state.error && (
              <pre className="w-full max-h-32 overflow-y-auto text-left text-[11px] font-mono text-red-300 bg-black/40 border border-red-500/20 rounded-lg p-2.5 mb-5 whitespace-pre-wrap break-all">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
              <button
                onClick={this.handleResetPath}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold text-xs border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <Home className="w-4 h-4" />
                <span>Reset to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
