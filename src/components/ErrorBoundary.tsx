import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  sectionLabel?: string;
  onResetStorage?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      `Recovered from render error in ${this.props.sectionLabel ?? 'workspace'}:`,
      error,
      info.componentStack
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  handleResetAndRetry = (): void => {
    this.props.onResetStorage?.();
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="max-w-[1360px] mx-auto px-6 py-12">
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <p className="text-xs font-semibold text-blue-700">
              Workspace Recovery
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Something interrupted this view
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We prevented a full-page crash in{' '}
              <span className="font-medium text-slate-800">
                {this.props.sectionLabel ?? 'this section'}
              </span>
              . You can retry loading the view, or clear saved browser session
              data if a previous session entry became corrupted.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              >
                Reload View
              </button>
              {this.props.onResetStorage && (
                <button
                  type="button"
                  onClick={this.handleResetAndRetry}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Clear Saved Sessions & Retry
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
