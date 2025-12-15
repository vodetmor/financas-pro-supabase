import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-lg border border-rose-100">
            <h2 className="text-xl font-bold text-rose-600 mb-2">Ops! Algo deu errado.</h2>
            <p className="text-slate-600 mb-4">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
            </p>
            <div className="bg-slate-100 p-3 rounded mb-4 overflow-auto max-h-40 text-xs text-slate-700 font-mono">
                {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
