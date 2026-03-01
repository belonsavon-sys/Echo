import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[app-error-boundary]", { error, errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-md border border-destructive/30 bg-card p-5 space-y-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">App error</h1>
            <p className="text-sm text-muted-foreground">
              A runtime error interrupted rendering. Reload and retry the last action.
            </p>
          </div>
          {import.meta.env.DEV && this.state.errorMessage ? (
            <pre className="text-xs rounded bg-muted p-3 overflow-auto">{this.state.errorMessage}</pre>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={this.handleReload} data-testid="button-reload-after-error">
              Reload app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
