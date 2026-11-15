import React from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application render error:", error, errorInfo);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.setState({ hasError: false, error: null });
    }
  };

  handleResetAndReload = () => {
    try {
      localStorage.removeItem("fileit_island_minimized_line");
      localStorage.removeItem("fileit_active_room_session");
    } catch {}
    this.handleReload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">
                  Something went wrong
                </h1>
                <p className="text-xs text-muted-foreground">
                  Fileit encountered a rendering issue.
                </p>
              </div>
            </div>

            {this.state.error?.message && (
              <pre className="text-xs font-mono bg-muted/60 border border-border/70 rounded-lg p-3 text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-secondary transition-colors cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
